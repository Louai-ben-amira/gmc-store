"""
Pre-order queue + fulfillment logic, shared by the client and admin views.

The one rule that shapes everything here: money moves at DELIVERY time, never
at pre-order time. So every fulfillment path re-checks the client's balance
against the price that was snapshotted when they queued up.
"""
import threading
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import PreOrder, SERVICE_FEE_RATE


class InsufficientBalance(Exception):
    """Client could not afford their locked-in price at delivery time."""

    def __init__(self, needed, available):
        self.needed    = Decimal(needed)
        self.available = Decimal(available)
        super().__init__(f'needs {self.needed} DT, has {self.available} DT')


class OutOfStock(Exception):
    """No code / variant stock left to hand this pre-order."""


def _fire(fn, *args, **kwargs):
    """Run a side-effect (email, Telegram) off the request thread - never blocks."""
    threading.Thread(target=lambda: _safe(fn, *args, **kwargs), daemon=True).start()


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception:
        return None


# -- Pricing ----------------------------------------------------------------

def quote(product, variant=None):
    """
    (price, service_fee) a client would lock in right now. Mirrors the normal
    checkout: flash-sale-aware product price (or the variant's own price),
    plus the site-wide 1% service fee.
    """
    base = Decimal(str(variant.price if variant is not None else product.effective_price))
    fee  = (base * SERVICE_FEE_RATE).quantize(Decimal('0.01'))
    return base, fee


def _points_for(preorder):
    """Loyalty points this fulfillment earns: variant override, then product, then global rate."""
    variant = preorder.variant
    if variant is not None and variant.points_earned > 0:
        return variant.points_earned
    if preorder.product.points_earned > 0:
        return preorder.product.points_earned
    rate = getattr(settings, 'POINTS_RATE', 1)
    return int(Decimal(preorder.price_at_order).to_integral_value(rounding=ROUND_HALF_UP)) * rate


# -- Queue ------------------------------------------------------------------

def recalculate_queue(product):
    """
    Renumber the product's pending pre-orders 1..N by created_at (FIFO), so
    positions stay contiguous after someone ahead cancels or is fulfilled.
    """
    pending = PreOrder.objects.filter(
        product=product, status='pending'
    ).order_by('created_at').only('id', 'queue_position')
    for i, po in enumerate(pending, 1):
        if po.queue_position != i:
            po.queue_position = i
            po.save(update_fields=['queue_position'])


def pending_count(product, variant=None):
    qs = PreOrder.objects.filter(product=product, status='pending')
    if variant is not None:
        qs = qs.filter(variant=variant)
    return qs.count()


# -- Fulfillment ------------------------------------------------------------

def fulfill_preorder(preorder, code=None, consume_stock=False):
    """
    Charge the client and hand them the code, atomically.

    `code`          - a products.Code row to attach (already created by the
                      caller for manual delivery, or picked from the available
                      pool for auto-fulfill).
    `consume_stock` - True when the code/variant unit came out of tracked
                      stock (auto-fulfill), False when the admin supplied a
                      code out of band (manual delivery adds a new sold row,
                      which never touched the available pool).

    Raises InsufficientBalance if the client can't cover their locked price.
    Must be called inside transaction.atomic().
    Returns the created orders.Order.
    """
    from django.contrib.auth import get_user_model
    from apps.orders.models import Order
    from apps.products.models import ProductVariant, get_effective_cost
    from apps.users.models import WalletTransaction

    User = get_user_model()

    # Lock the wallet row: the balance check and the debit must not race with
    # a concurrent purchase or another admin fulfilling a second pre-order.
    client = User.objects.select_for_update().get(pk=preorder.user_id)
    total  = preorder.total_at_order

    if client.balance < total:
        raise InsufficientBalance(total, client.balance)

    product = preorder.product
    variant = preorder.variant

    if consume_stock and variant is not None:
        variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
        if variant.stock_count <= 0:
            raise OutOfStock()

    unit_cost = get_effective_cost(product, variant)
    points    = _points_for(preorder)

    order = Order.objects.create(
        user=client,
        product=product,
        variant=preorder.variant,
        code=code,
        amount_paid=total,
        service_fee=preorder.service_fee_at_order,
        points_earned=points,
        points_used=0,
        status=Order.Status.COMPLETED,
        escrow_held=False,
        requires_account=False,
        quantity=1,
        cost_price_at_sale=unit_cost,
        profit_at_sale=(total - unit_cost) if unit_cost is not None else None,
    )

    if code is not None:
        code.status = 'sold'
        code.order  = order
        code.save(update_fields=['status', 'order'])

    if consume_stock:
        if variant is not None:
            variant.stock_count = max(0, variant.stock_count - 1)
            variant.save(update_fields=['stock_count'])
        else:
            # Codes are the source of truth for non-variant products
            product.stock_count = product.codes.filter(status='available').count()
            product.save(update_fields=['stock_count'])

    client.balance -= total
    client.points  += points
    client.save(update_fields=['balance', 'points'])

    WalletTransaction.objects.create(
        user=client, type='debit', amount=total, method='wallet',
        note=f'Pre-order fulfilled: {product.name}'
             + (f' - {preorder.variant.label}' if preorder.variant_id else ''),
    )

    preorder.status         = 'fulfilled'
    preorder.order          = order
    preorder.fulfilled_at   = timezone.now()
    preorder.failure_reason = ''
    preorder.save(update_fields=['status', 'order', 'fulfilled_at', 'failure_reason'])

    # Both of these are DB writes that belong to the same unit of work as the
    # delivery itself - the client's bell notification must not survive a
    # rolled-back charge, and the vacated queue slot must close immediately.
    recalculate_queue(product)
    _safe(lambda: notify_fulfilled(preorder))

    # The email is the only genuine outside-world side effect, so it waits
    # until the charge is actually committed.
    order_id = order.id
    transaction.on_commit(lambda: _send_fulfilled_email(order_id))
    return order


def _send_fulfilled_email(order_id):
    try:
        from apps.orders.tasks import send_order_confirmation_email
        _fire(send_order_confirmation_email.delay, order_id)
    except Exception:
        pass


def mark_skipped(preorder, needed, available, status='expired'):
    """
    Flag a pre-order the admin (or auto-fulfill) had to pass over because the
    client's wallet was short. 'expired' keeps it visible to the admin and to
    the client; 'failed' is the admin explicitly dropping it from the queue.
    """
    preorder.status         = status
    preorder.failure_reason = f'Insufficient balance at delivery: needed {needed} DT, had {available} DT'
    preorder.save(update_fields=['status', 'failure_reason'])
    recalculate_queue(preorder.product)
    _safe(lambda: notify_insufficient_balance(preorder, needed, available))


def auto_fulfill_product(product):
    """
    Walk the product's pending pre-orders oldest-first and deliver to each one
    while stock lasts. Returns (results, counts).

    Non-variant pre-orders draw from the product's available Code rows;
    variant pre-orders draw down that variant's stock_count (variants never
    use Code rows - same split as the normal checkout). A pre-order whose own
    pool is empty is reported and stepped over rather than stopping the run,
    so an out-of-stock variant can't block the rest of the queue.
    """
    from apps.products.models import Code

    results   = []
    exhausted = set()   # variant ids (None = the product's code pool) already empty

    pending = list(
        PreOrder.objects.filter(product=product, status='pending')
        .select_related('user', 'variant', 'product')
        .order_by('created_at')
    )

    for preorder in pending:
        pool_key = preorder.variant_id
        if pool_key in exhausted:
            results.append(_result(preorder, 'no_stock', 'No stock left for this option'))
            continue

        try:
            with transaction.atomic():
                code = None
                if preorder.variant_id is None:
                    code = (
                        Code.objects.select_for_update(skip_locked=True)
                        .filter(product=product, status='available')
                        .order_by('created_at')
                        .first()
                    )
                    if code is None:
                        exhausted.add(pool_key)
                        results.append(_result(preorder, 'no_stock', 'No available codes left'))
                        continue
                fulfill_preorder(preorder, code=code, consume_stock=True)
        except OutOfStock:
            exhausted.add(pool_key)
            results.append(_result(preorder, 'no_stock', 'No stock left for this option'))
            continue
        except InsufficientBalance as exc:
            mark_skipped(preorder, exc.needed, exc.available)
            results.append(_result(
                preorder, 'skipped',
                f'Insufficient balance - needed {exc.needed} DT, had {exc.available} DT',
            ))
            continue

        results.append(_result(preorder, 'fulfilled', 'Delivered'))

    counts = {
        'fulfilled': sum(1 for r in results if r['status'] == 'fulfilled'),
        'skipped':   sum(1 for r in results if r['status'] == 'skipped'),
        'no_stock':  sum(1 for r in results if r['status'] == 'no_stock'),
    }
    return results, counts


def _result(preorder, status, reason):
    return {
        'preorder_id': preorder.id,
        'client':      preorder.user.username,
        'status':      status,
        'reason':      reason,
    }


# -- Notifications ----------------------------------------------------------

def _label(preorder):
    name = preorder.product.name
    return f'{name} ({preorder.variant.label})' if preorder.variant_id else name


def notify_placed(preorder):
    from apps.notifications.services import notify_event
    notify_event(
        preorder.user, 'preorder_placed', link='/preorders',
        position=preorder.queue_position, product=_label(preorder),
    )
    try:
        from .tasks import send_preorder_placed_email
        _fire(send_preorder_placed_email.delay, preorder.id)
    except Exception:
        pass
    _telegram(
        f'\U0001F4CB <b>New pre-order</b>\n'
        f'{_label(preorder)}\n'
        f'{preorder.user.username}\n'
        f'Queue position: #{preorder.queue_position}\n'
        f'Locked: {preorder.total_at_order} DT'
    )


def notify_fulfilled(preorder):
    from apps.notifications.services import notify_event
    notify_event(
        preorder.user, 'preorder_fulfilled',
        link=f'/orders/{preorder.order_id}' if preorder.order_id else '/orders',
        product=_label(preorder), amount=preorder.total_at_order,
    )


def notify_insufficient_balance(preorder, needed, available):
    from apps.notifications.services import notify_event
    notify_event(
        preorder.user, 'preorder_failed', link='/wallet',
        product=_label(preorder),
    )
    try:
        from .tasks import send_preorder_failed_email
        _fire(send_preorder_failed_email.delay, preorder.id)
    except Exception:
        pass


def notify_cancelled(preorder):
    _telegram(
        f'❌ <b>Pre-order cancelled</b>\n'
        f'{_label(preorder)}\n'
        f'{preorder.user.username}'
    )


def _telegram(message):
    try:
        from apps.payments.tasks import send_telegram_alert
        _fire(send_telegram_alert.delay, message)
    except Exception:
        pass

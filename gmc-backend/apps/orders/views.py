import uuid
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction, models
from django.db.models import Prefetch
from django.conf import settings
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
from .models import Order, PromoCode, PromoCodeUsage, OrderCredentials, OrderCodeViewLog
from .serializers import (
    OrderSerializer, PlaceOrderSerializer, PromoCodeSerializer, OrderCredentialsSerializer,
    BasketCheckoutSerializer,
)
from apps.products.models import Product, Code, Bundle, ProductVariant, get_effective_cost
from apps.users.models import WalletTransaction
from apps.users.permissions import IsAdmin, require_verified_email
from config.throttles import OrderRateThrottle


SERVICE_FEE_RATE = Decimal('0.01')  # 1% service fee on all purchases


def _points_from_amount(amount, points_rate):
    """Round-to-nearest DT spent, converted to loyalty points (e.g. 4.99 DT -> 5 pts at rate 1)."""
    return int(Decimal(amount).to_integral_value(rounding=ROUND_HALF_UP)) * points_rate


def _order_list_queryset():
    """
    Base queryset for serializing lists of orders with OrderSerializer.

    Pulls every relation the serializer touches in a constant number of
    queries: select_related for the forward FK / reverse one-to-one fields
    (code, bundle, promo_code, variant, credentials), and a Prefetch for the
    embedded product card so the nested ProductSerializer reuses the
    annotated/variant-prefetched product instead of firing its own ~5 queries
    per order, plus a Prefetch of open order-tickets (see
    OrderSerializer.get_open_ticket_id).
    """
    from apps.tickets.models import OrderTicket
    return Order.objects.select_related(
        'code', 'bundle', 'promo_code', 'variant', 'credentials',
    ).prefetch_related(
        'codes',
        Prefetch('product', queryset=Product.objects.select_related('category').with_card_data()),
        Prefetch('tickets', queryset=OrderTicket.objects.filter(status__in=('open', 'in_progress')), to_attr='open_tickets'),
    )


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _fire(fn, *args, **kwargs):
    """Run a callable (e.g. Celery .delay()) in a daemon thread so it never blocks the response."""
    import threading
    threading.Thread(target=lambda: fn(*args, **kwargs), daemon=True).start()


def _notify_order_complete(order):
    """In-app bell notification once an order's code/service is ready to reveal."""
    from apps.notifications.services import notify
    name = order.product.name if order.product_id else (order.bundle.name if order.bundle_id else 'Your order')
    notify(
        order.user, 'order_complete', 'Order Ready',
        f'Your {name} is ready — click to reveal your code.',
        link=f'/orders/{order.id}',
    )


# ── Order List / Create ────────────────────────────────────────────────────

class OrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes   = [OrderRateThrottle]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PlaceOrderSerializer
        return OrderSerializer

    def get_queryset(self):
        return _order_list_queryset().filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        require_verified_email(request.user)

        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id    = serializer.validated_data.get('product_id')
        bundle_id     = serializer.validated_data.get('bundle_id')
        variant_id    = serializer.validated_data.get('variant_id')
        quantity      = serializer.validated_data['quantity']
        points_to_use = serializer.validated_data['points_to_use']
        promo_str     = serializer.validated_data.get('promo_code', '').strip().upper()
        credentials   = serializer.validated_data.get('credentials', {})

        user        = request.user
        points_rate = getattr(settings, 'POINTS_RATE', 1)

        # Resolve promo
        promo_obj      = None
        promo_discount = Decimal('0')
        if promo_str:
            try:
                promo_obj = PromoCode.objects.get(code=promo_str)
            except PromoCode.DoesNotExist:
                return Response({'detail': 'Invalid promo code.'}, status=status.HTTP_400_BAD_REQUEST)
            valid, err = promo_obj.check_valid(user=user)
            if not valid:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        # ── Bundle order ───────────────────────────────────────────────────
        if bundle_id:
            if quantity > 1:
                return Response({'detail': 'Quantity is not supported for bundles.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                bundle = Bundle.objects.get(pk=bundle_id, is_active=True)
            except Bundle.DoesNotExist:
                return Response({'detail': 'Bundle not found.'}, status=status.HTTP_404_NOT_FOUND)

            base_price = Decimal(str(bundle.bundle_price))
            if promo_obj:
                promo_discount = promo_obj.calculate_discount(base_price)

            max_redeemable = (min(user.points, int(base_price * 50)) // 100) * 100
            if points_to_use > max_redeemable:
                return Response({'detail': f'Max redeemable points: {max_redeemable}'}, status=status.HTTP_400_BAD_REQUEST)

            subtotal    = max(Decimal('0'), base_price - promo_discount - Decimal(points_to_use) / 100)
            service_fee = (subtotal * SERVICE_FEE_RATE).quantize(Decimal('0.01'))
            final_price = subtotal + service_fee
            if user.balance < final_price:
                return Response({'detail': 'Insufficient balance.'}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                points_earned = _points_from_amount(subtotal, points_rate)
                user.balance -= final_price
                user.points  += points_earned - points_to_use
                user.save()

                order = Order.objects.create(
                    user=user, bundle=bundle,
                    amount_paid=final_price,
                    service_fee=service_fee,
                    discount_amount=promo_discount,
                    points_earned=points_earned,
                    points_used=points_to_use,
                    promo_code=promo_obj,
                    status=Order.Status.COMPLETED,
                )

                if promo_obj:
                    promo_obj.used_count += 1
                    promo_obj.save()
                    PromoCodeUsage.objects.create(promo_code=promo_obj, user=user, order=order)

                WalletTransaction.objects.create(
                    user=user, type='debit', amount=final_price,
                    method='wallet', note=f'Bundle purchase: {bundle.name}'
                )

            try:
                from apps.orders.tasks import send_order_confirmation_email
                _fire(send_order_confirmation_email.delay, order.id)
            except Exception:
                pass
            _notify_order_complete(order)

            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

        # ── Single product order ───────────────────────────────────────────
        try:
            product = Product.objects.select_related('category').get(pk=product_id, visible=True)
        except Product.DoesNotExist:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        has_phone_field = any(
            f.get('type') == 'tel' or f.get('key') == 'phone'
            for f in (product.required_fields or [])
        )
        needs_credentials = product.requires_account or has_phone_field or (
            product.category and product.category.requires_account
        )
        if needs_credentials and not credentials:
            return Response(
                {'detail': 'This product requires account credentials.', 'requires_account': True},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if needs_credentials and quantity > 1:
            return Response(
                {'detail': 'Quantity is not supported for products that require account credentials.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity > 1 and points_to_use > 0:
            return Response(
                {'detail': 'Points cannot be combined with a quantity greater than 1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve variant if product has variants
        selected_variant = None
        if product.has_variants:
            if not variant_id:
                return Response({'detail': 'Please select a variant for this product.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                selected_variant = ProductVariant.objects.get(pk=variant_id, product=product, is_active=True)
            except ProductVariant.DoesNotExist:
                return Response({'detail': 'Selected variant not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)
            if selected_variant.stock_count < quantity:
                return Response({'detail': 'Not enough stock available for the selected quantity.'}, status=status.HTTP_400_BAD_REQUEST)

        if points_to_use > 0 and not product.points_purchasable:
            return Response({'detail': 'Points cannot be used for this product.'}, status=status.HTTP_400_BAD_REQUEST)

        base_price = Decimal(str(selected_variant.price if selected_variant else product.effective_price))
        if promo_obj:
            promo_discount = promo_obj.calculate_discount(base_price)

        max_redeemable = (min(user.points, int(base_price * 50)) // 100) * 100
        if points_to_use > max_redeemable:
            return Response({'detail': f'Max redeemable points: {max_redeemable}'}, status=status.HTTP_400_BAD_REQUEST)

        subtotal    = max(Decimal('0'), base_price - promo_discount - Decimal(points_to_use) / 100)
        service_fee = (subtotal * SERVICE_FEE_RATE).quantize(Decimal('0.01'))
        final_price = subtotal + service_fee
        total_price = final_price * quantity
        if user.balance < total_price:
            return Response({'detail': 'Insufficient balance.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            codes = []
            if selected_variant:
                # Variant products track stock on the variant, never on Code rows
                selected_variant = ProductVariant.objects.select_for_update().get(pk=selected_variant.pk)
                if selected_variant.stock_count < quantity:
                    return Response({'detail': 'Not enough stock available for the selected quantity.'}, status=status.HTTP_400_BAD_REQUEST)
            elif needs_credentials:
                # Service/account orders use product.stock_count — no Code row needed
                if product.stock_count <= 0:
                    return Response({'detail': 'Product out of stock.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                codes = list(Code.objects.select_for_update().filter(
                    product=product, status='available'
                )[:quantity])
                if len(codes) < quantity:
                    return Response({'detail': 'Not enough stock available for the selected quantity.'}, status=status.HTTP_400_BAD_REQUEST)

            # Use variant-level points if set, then product-level, then global rate
            if selected_variant and selected_variant.points_earned > 0:
                points_earned = selected_variant.points_earned
            elif product.points_earned > 0:
                points_earned = product.points_earned
            else:
                points_earned = _points_from_amount(subtotal, points_rate)

            user.balance -= total_price
            user.points  += (points_earned * quantity) - points_to_use
            user.save()

            # Cost/profit snapshot - stored as the TOTAL for this order (unit
            # cost × quantity) so it lines up directly with amount_paid, which
            # is also a total. None when no cost_price is set anywhere.
            unit_cost = get_effective_cost(product, selected_variant)
            cost_total = (unit_cost * quantity) if unit_cost is not None else None

            # One order per purchase: quantity>1 creates a single order holding
            # all N codes (Code.order FK). Money/points fields store totals.
            if needs_credentials:
                order = Order.objects.create(
                    user=user, product=product,
                    variant=selected_variant,
                    amount_paid=final_price,
                    service_fee=service_fee,
                    discount_amount=promo_discount,
                    points_earned=points_earned,
                    points_used=points_to_use,
                    promo_code=promo_obj,
                    status=Order.Status.PAID_ESCROW,
                    escrow_held=True,
                    requires_account=True,
                    service_status='pending',
                    quantity=1,
                    cost_price_at_sale=cost_total,
                    profit_at_sale=(final_price - cost_total) if cost_total is not None else None,
                )
            else:
                order = Order.objects.create(
                    user=user, product=product,
                    variant=selected_variant,
                    amount_paid=total_price,
                    service_fee=(service_fee * quantity).quantize(Decimal('0.01')),
                    discount_amount=(promo_discount * quantity).quantize(Decimal('0.01')),
                    points_earned=points_earned * quantity,
                    points_used=points_to_use,
                    promo_code=promo_obj,
                    status=Order.Status.COMPLETED,
                    escrow_held=False,
                    requires_account=False,
                    service_status='pending',
                    quantity=quantity,
                    cost_price_at_sale=cost_total,
                    profit_at_sale=(total_price - cost_total) if cost_total is not None else None,
                )

            for code in codes:
                code.status = 'sold'
                code.order  = order
                code.save(update_fields=['status', 'order'])
            if codes:
                order.code = codes[0]
                order.save(update_fields=['code'])

            if codes:
                # Keep stock_count accurate: count remaining available codes
                product.stock_count = product.codes.filter(status='available').count()
                product.save(update_fields=['stock_count'])
            elif selected_variant:
                selected_variant.stock_count = max(0, selected_variant.stock_count - quantity)
                selected_variant.save(update_fields=['stock_count'])
            else:
                product.stock_count = max(0, product.stock_count - quantity)
                product.save(update_fields=['stock_count'])

            if promo_obj:
                promo_obj.used_count += quantity
                promo_obj.save()
                PromoCodeUsage.objects.create(promo_code=promo_obj, user=user, order=order)

            WalletTransaction.objects.create(
                user=user, type='debit', amount=total_price,
                method='wallet',
                note=f'Purchase: {product.name}' + (f' x{quantity}' if quantity > 1 else ''),
            )
            if points_earned > 0:
                WalletTransaction.objects.create(
                    user=user, type='credit', amount=0,
                    method='points', note=f'Points earned: {points_earned * quantity} for order #{order.id}'
                )

            if needs_credentials and credentials:
                creds = OrderCredentials(order=order)
                creds.set_data(credentials)
                creds.save()

        # The encrypted payload is purged when the buyer confirms delivery
        # (see confirm_delivery), in the same transaction as the escrow release.

        try:
            from apps.orders.tasks import send_order_confirmation_email
            _fire(send_order_confirmation_email.delay, order.id)
        except Exception:
            pass

        if order.status == Order.Status.COMPLETED:
            _notify_order_complete(order)

        try:
            from apps.payments.tasks import send_telegram_alert
            low_threshold = getattr(settings, 'LOW_STOCK_THRESHOLD', 3)
            _fire(send_telegram_alert.delay,
                f"New Order #{order.id}" + (f" (x{quantity})" if quantity > 1 else '') + "\n"
                f"{user.username}\n"
                f"{product.name}\n"
                f"{total_price} DT"
                + (" - Requires credentials" if needs_credentials else '')
            )
            if product.stock_count <= low_threshold:
                _fire(send_telegram_alert.delay,  # noqa
                    f"⚠️ <b>Low Stock: {product.name}</b>\n"
                    f"Only <b>{product.stock_count}</b> left!"
                )
        except Exception:
            pass

        try:
            from apps.users.referral import handle_referral_first_purchase
            _fire(handle_referral_first_purchase, user)
        except Exception:
            pass

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _order_list_queryset().filter(user=self.request.user)


# ── Basket checkout ─────────────────────────────────────────────────────────

class BasketCheckoutView(generics.GenericAPIView):
    """
    Pays for every item in the basket in one transaction (one balance debit,
    one batch_id grouping the resulting Orders), while letting individual
    out-of-stock items fail without rolling back the rest of the basket.

    Design (see plan): resolve + price every item against the FULL basket
    up front (so promo/points are allocated once, consistently); check the
    user can afford the full basket before touching anything; then reserve
    stock and create one Order per item inside its OWN small transaction so
    an out-of-stock item can't undo sibling items already reserved; finally
    debit the user for exactly the successful items' total in one last
    transaction (always affordable, since it's <= the pre-checked full total).
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes   = [OrderRateThrottle]

    def post(self, request):
        require_verified_email(request.user)

        serializer = BasketCheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items_data    = serializer.validated_data['items']
        points_to_use = serializer.validated_data['points_to_use']
        promo_str     = serializer.validated_data.get('promo_code', '').strip().upper()

        user        = request.user
        points_rate = getattr(settings, 'POINTS_RATE', 1)

        promo_obj = None
        if promo_str:
            try:
                promo_obj = PromoCode.objects.get(code=promo_str)
            except PromoCode.DoesNotExist:
                return Response({'detail': 'Invalid promo code.'}, status=status.HTTP_400_BAD_REQUEST)
            valid, err = promo_obj.check_valid(user=user)
            if not valid:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        # ── Resolve every item (product/variant lookup, credential/variant
        # validation). These are hard failures - a malformed basket item is a
        # client bug, not a stock race, so the whole request is rejected.
        resolved = []
        for item in items_data:
            try:
                product = Product.objects.select_related('category').get(pk=item['product_id'], visible=True)
            except Product.DoesNotExist:
                return Response({'detail': f"Product #{item['product_id']} not found."}, status=status.HTTP_404_NOT_FOUND)

            quantity    = item['quantity']
            credentials = item.get('credentials') or {}

            has_phone_field = any(
                f.get('type') == 'tel' or f.get('key') == 'phone'
                for f in (product.required_fields or [])
            )
            needs_credentials = product.requires_account or has_phone_field or (
                product.category and product.category.requires_account
            )
            if needs_credentials and not credentials:
                return Response(
                    {'detail': f'{product.name} requires account credentials.', 'requires_account': True},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if needs_credentials and quantity > 1:
                return Response(
                    {'detail': f'Quantity is not supported for {product.name} (requires account credentials).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            selected_variant = None
            if product.has_variants:
                if not item.get('variant_id'):
                    return Response({'detail': f'Please select a variant for {product.name}.'}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    selected_variant = ProductVariant.objects.get(pk=item['variant_id'], product=product, is_active=True)
                except ProductVariant.DoesNotExist:
                    return Response({'detail': f'Selected variant not found for {product.name}.'}, status=status.HTTP_404_NOT_FOUND)

            base_price = Decimal(str(selected_variant.price if selected_variant else product.effective_price))
            unit_cost  = get_effective_cost(product, selected_variant)
            resolved.append({
                'product': product, 'variant': selected_variant, 'quantity': quantity,
                'needs_credentials': needs_credentials, 'credentials': credentials,
                'base_price': base_price, 'line_total': base_price * quantity,
                'cost_total': (unit_cost * quantity) if unit_cost is not None else None,
            })

        subtotal = sum((it['line_total'] for it in resolved), Decimal('0'))

        if points_to_use > 0 and any(it['quantity'] > 1 for it in resolved):
            return Response(
                {'detail': 'Points cannot be combined with a basket item that has quantity greater than 1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if points_to_use > 0 and not all(it['product'].points_purchasable for it in resolved):
            return Response({'detail': 'One or more items in this basket do not allow points redemption.'}, status=status.HTTP_400_BAD_REQUEST)

        promo_discount = promo_obj.calculate_discount(subtotal) if promo_obj else Decimal('0')

        max_redeemable = (min(user.points, int(subtotal * 50)) // 100) * 100
        if points_to_use > max_redeemable:
            return Response({'detail': f'Max redeemable points: {max_redeemable}'}, status=status.HTTP_400_BAD_REQUEST)

        total_reduction = promo_discount + Decimal(points_to_use) / 100

        # Allocate the shared discount/points reduction + 1% service fee to
        # each line proportionally to its share of the subtotal. The last
        # item absorbs any rounding remainder so the per-item amounts always
        # sum exactly to the basket total (no stray cents).
        running_reduction = Decimal('0')
        running_final     = Decimal('0')
        for i, it in enumerate(resolved):
            if i < len(resolved) - 1 and subtotal > 0:
                share = (total_reduction * it['line_total'] / subtotal).quantize(Decimal('0.01'))
            else:
                share = total_reduction - running_reduction
            running_reduction += share

            post_discount = max(Decimal('0'), it['line_total'] - share)
            service_fee   = (post_discount * SERVICE_FEE_RATE).quantize(Decimal('0.01'))
            it['discount_amount'] = share
            it['service_fee']     = service_fee
            it['final_price']     = post_discount + service_fee
            it['profit']          = (it['final_price'] - it['cost_total']) if it['cost_total'] is not None else None
            running_final += it['final_price']

            if it['variant'] and it['variant'].points_earned > 0:
                it['points_earned'] = it['variant'].points_earned * it['quantity']
            elif it['product'].points_earned > 0:
                it['points_earned'] = it['product'].points_earned * it['quantity']
            else:
                it['points_earned'] = _points_from_amount(post_discount, points_rate)

        total_due = running_final
        if user.balance < total_due:
            return Response({'detail': 'Insufficient balance.'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Reserve stock + create one Order per item, each in its own
        # transaction so a stock-out on one item can't roll back siblings
        # that already reserved successfully.
        batch_id       = uuid.uuid4()
        created_orders = []
        failed_items   = []

        for it in resolved:
            product, variant, quantity = it['product'], it['variant'], it['quantity']
            try:
                with transaction.atomic():
                    codes = []
                    if variant:
                        variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
                        if variant.stock_count < quantity:
                            raise ValueError('Not enough stock for the selected variant.')
                    elif it['needs_credentials']:
                        product = Product.objects.select_for_update().get(pk=product.pk)
                        if product.stock_count <= 0:
                            raise ValueError('Product is out of stock.')
                    else:
                        codes = list(Code.objects.select_for_update().filter(
                            product=product, status='available'
                        )[:quantity])
                        if len(codes) < quantity:
                            raise ValueError('Not enough stock available.')

                    if it['needs_credentials']:
                        order = Order.objects.create(
                            user=user, product=product, variant=variant,
                            amount_paid=it['final_price'], service_fee=it['service_fee'],
                            discount_amount=it['discount_amount'], points_earned=it['points_earned'],
                            status=Order.Status.PAID_ESCROW, escrow_held=True,
                            requires_account=True, service_status='pending',
                            quantity=1, batch_id=batch_id,
                            cost_price_at_sale=it['cost_total'], profit_at_sale=it['profit'],
                        )
                        creds = OrderCredentials(order=order)
                        creds.set_data(it['credentials'])
                        creds.save()
                    else:
                        order = Order.objects.create(
                            user=user, product=product, variant=variant,
                            amount_paid=it['final_price'], service_fee=it['service_fee'],
                            discount_amount=it['discount_amount'], points_earned=it['points_earned'],
                            status=Order.Status.COMPLETED, escrow_held=False,
                            requires_account=False, service_status='pending',
                            quantity=quantity, batch_id=batch_id,
                            cost_price_at_sale=it['cost_total'], profit_at_sale=it['profit'],
                        )
                        for code in codes:
                            code.status = 'sold'
                            code.order  = order
                            code.save(update_fields=['status', 'order'])
                        if codes:
                            order.code = codes[0]
                            order.save(update_fields=['code'])

                    if codes:
                        product.stock_count = product.codes.filter(status='available').count()
                        product.save(update_fields=['stock_count'])
                    elif variant:
                        variant.stock_count = max(0, variant.stock_count - quantity)
                        variant.save(update_fields=['stock_count'])
                    elif it['needs_credentials']:
                        product.stock_count = max(0, product.stock_count - 1)
                        product.save(update_fields=['stock_count'])

                    created_orders.append((order, it))
            except ValueError as exc:
                failed_items.append({'product_name': product.name, 'reason': str(exc)})

        if not created_orders:
            return Response(
                {'detail': 'All items in this basket are unavailable.', 'failed_items': failed_items},
                status=status.HTTP_409_CONFLICT,
            )

        # ── One aggregate balance/points debit for everything that succeeded.
        # Always affordable: the successful subset's total can only be <= the
        # full-basket total already checked against user.balance above.
        actual_total          = sum((o.amount_paid for o, _ in created_orders), Decimal('0'))
        actual_points_earned  = sum((it['points_earned'] for _, it in created_orders), 0)
        # Points redeemed are scaled down if some items failed, proportional
        # to how much of the basket's value actually went through.
        actual_points_used = points_to_use if actual_total == total_due else (
            int(points_to_use * (actual_total / total_due)) // 100 * 100 if total_due > 0 else 0
        )

        with transaction.atomic():
            locked_user = type(user).objects.select_for_update().get(pk=user.pk)
            locked_user.balance -= actual_total
            locked_user.points  += actual_points_earned - actual_points_used
            locked_user.save(update_fields=['balance', 'points'])

            if promo_obj and actual_total > 0:
                promo_obj.used_count += 1
                promo_obj.save(update_fields=['used_count'])
                PromoCodeUsage.objects.create(promo_code=promo_obj, user=locked_user, order=created_orders[0][0])

            WalletTransaction.objects.create(
                user=locked_user, type='debit', amount=actual_total,
                method='wallet', note=f'Basket checkout — {len(created_orders)} item(s)',
            )
            if actual_points_earned > 0:
                WalletTransaction.objects.create(
                    user=locked_user, type='credit', amount=0,
                    method='points', note=f'Points earned: {actual_points_earned} for basket checkout',
                )

        for order, it in created_orders:
            try:
                from apps.orders.tasks import send_order_confirmation_email
                _fire(send_order_confirmation_email.delay, order.id)
            except Exception:
                pass

        completed_orders = [o for o, _ in created_orders if o.status == Order.Status.COMPLETED]
        if len(completed_orders) == 1:
            _notify_order_complete(completed_orders[0])
        elif len(completed_orders) > 1:
            from apps.notifications.services import notify
            notify(
                user, 'order_complete', 'Order Ready',
                f'Your basket order ({len(completed_orders)} items) is ready — click to reveal your codes.',
                link='/orders',
            )

        try:
            from apps.payments.tasks import send_telegram_alert
            _fire(send_telegram_alert.delay,
                f"New Basket Checkout — {len(created_orders)} item(s)\n"
                f"{user.username}\n"
                f"{actual_total} DT"
                + (f"\n{len(failed_items)} item(s) failed (out of stock)" if failed_items else '')
            )
        except Exception:
            pass

        try:
            from apps.users.referral import handle_referral_first_purchase
            _fire(handle_referral_first_purchase, user)
        except Exception:
            pass

        orders_data = OrderSerializer(
            [o for o, _ in created_orders], many=True, context={'request': request}
        ).data
        return Response(
            {'orders': orders_data, 'failed_items': failed_items},
            status=status.HTTP_201_CREATED,
        )


# ── Credentials reveal (admin only) ───────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdmin])
def order_credentials(request, pk):
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        creds = order.credentials
    except OrderCredentials.DoesNotExist:
        return Response({'detail': 'No credentials for this order.'}, status=status.HTTP_404_NOT_FOUND)

    if creds.deleted_at:
        return Response({'detail': 'Credentials have been purged per retention policy.'}, status=status.HTTP_410_GONE)

    ip = _get_client_ip(request)
    creds.log_access(request.user, ip=ip)

    data = OrderCredentialsSerializer(creds).data
    # Decrypt and include plaintext only in this authenticated response
    try:
        data['credentials_data'] = creds.get_data()
    except Exception:
        data['credentials_data'] = None

    return Response(data)


# ── Service status update (admin only) ─────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAdmin])
def update_service_status(request, pk):
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('service_status')
    note       = request.data.get('note', '').strip()

    if new_status not in ['pending', 'in_progress', 'completed']:
        return Response({'detail': 'Invalid service_status.'}, status=status.HTTP_400_BAD_REQUEST)

    old_status = order.service_status
    order.service_status = new_status

    if new_status == 'in_progress':
        order.status = Order.Status.IN_PROGRESS
    elif new_status == 'completed':
        order.status = Order.Status.COMPLETED
        # Seller has completed - buyer must still confirm to release escrow.
        # Do NOT release here.

    order.save()

    if new_status == 'completed' and old_status != 'completed':
        _notify_order_complete(order)

    return Response(OrderSerializer(order).data)


# ── Buyer: confirm delivery (releases escrow) ──────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def confirm_delivery(request, pk):
    """
    Buyer confirms they received the service.
    Releases escrow to admin balance, closes the order, purges credentials.
    """
    try:
        order = Order.objects.select_related('product', 'user').get(
            pk=pk, user=request.user
        )
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status not in (Order.Status.COMPLETED, Order.Status.IN_PROGRESS):
        return Response(
            {'detail': 'Order cannot be confirmed in its current state.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not order.escrow_held:
        return Response({'detail': 'No escrow to release for this order.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        order.status      = Order.Status.CLOSED
        order.escrow_held = False
        order.save()

        # Release funds to admin/seller balance
        from apps.users.models import User
        admin = User.objects.filter(role='admin').first()
        if admin:
            admin.balance += order.amount_paid
            admin.save(update_fields=['balance'])
            WalletTransaction.objects.create(
                user=admin, type='credit', amount=order.amount_paid,
                method='escrow_release',
                note=f'Escrow released: Order #{order.id}'
            )

        # Purge the encrypted payload in the same transaction as the escrow
        # release, so the order can never be left settled-but-not-purged: if
        # the purge fails, the release rolls back and the buyer can retry.
        # The row is kept for audit; only the payload is cleared.
        try:
            order.credentials.purge_payload()
        except OrderCredentials.DoesNotExist:
            pass

    try:
        from apps.payments.tasks import send_telegram_alert
        _fire(send_telegram_alert.delay,
            f"Order #{order.id} confirmed by buyer\n"
            f"{order.user.username}\n"
            f"{order.amount_paid} DT released from escrow"
        )
    except Exception:
        pass

    return Response(OrderSerializer(order).data)


# ── Buyer: open dispute ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def open_dispute(request, pk):
    """
    Buyer opens a dispute. Escrow stays held. Order flagged for admin review.
    """
    try:
        order = Order.objects.get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status not in (
        Order.Status.PAID_ESCROW,
        Order.Status.IN_PROGRESS,
        Order.Status.COMPLETED,
    ):
        return Response(
            {'detail': 'Cannot dispute an order in its current state.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    reason = request.data.get('reason', '').strip()

    order.status = Order.Status.DISPUTED
    order.save()

    try:
        from apps.payments.tasks import send_telegram_alert
        _fire(send_telegram_alert.delay,
            f"DISPUTE: Order #{order.id}\n"
            f"{order.user.username}\n"
            f"{order.amount_paid} DT in escrow\n"
            + (reason or '')
        )
    except Exception:
        pass

    return Response(OrderSerializer(order).data)


# ── Reveal code (client) ──────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reveal_code(request, pk):
    """
    First call: records reveal time/IP, returns the code.
    Subsequent calls: idempotent - returns code again with already_revealed=True.
    Code is never sent in the standard list/detail response; only via this endpoint.
    """
    try:
        order = Order.objects.select_related('code').prefetch_related('codes').get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    # All codes attached to this order (quantity>1 orders hold several).
    code_values = [c.code for c in sorted(order.codes.all(), key=lambda c: c.id)]
    if not code_values and order.code:
        code_values = [order.code.code]

    if not code_values:
        return Response({'detail': 'No code available for this order.'}, status=status.HTTP_400_BAD_REQUEST)

    if order.status != Order.Status.COMPLETED:
        return Response({'detail': 'Order is not in a completed state.'}, status=status.HTTP_400_BAD_REQUEST)

    ip = _get_client_ip(request)
    already = order.code_viewed_at is not None

    if not already:
        with transaction.atomic():
            locked = Order.objects.select_for_update().get(pk=order.pk)
            if locked.code_viewed_at is None:
                now = timezone.now()
                locked.code_viewed_at = now
                locked.code_view_ip   = ip
                locked.save(update_fields=['code_viewed_at', 'code_view_ip'])
                OrderCodeViewLog.objects.create(
                    order=locked, viewed_at=now, ip_address=ip
                )
                order.code_viewed_at = now  # sync local obj for serializer

    return Response({
        'code':             code_values[0],
        'codes':            code_values,
        'already_revealed': already,
        'viewed_at':        order.code_viewed_at,
    })


# ── Cancel order (client) ─────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_order(request, pk):
    """
    Client self-cancel. Only allowed before the code has been revealed.
    Refunds balance, returns code to available pool, cancels the order.
    """
    try:
        order = Order.objects.select_related('code', 'user').get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not order.is_refund_eligible:
        if order.code_viewed_at is not None:
            return Response(
                {'detail': 'Code has already been revealed. This order cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {'detail': 'This order cannot be cancelled.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        # of=('self',) restricts the row lock to the orders table - code is a nullable
        # OneToOneField, and Postgres rejects FOR UPDATE across a LEFT OUTER JOIN on it.
        locked = Order.objects.select_for_update(of=('self',)).select_related('code', 'user').get(pk=order.pk)

        # Double-check after lock
        if locked.code_viewed_at is not None or locked.status != Order.Status.COMPLETED:
            return Response(
                {'detail': 'Order state changed. Cannot cancel.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Return every code attached to this order (quantity>1 orders hold several)
        returned_codes = list(locked.codes.all()) or ([locked.code] if locked.code else [])
        for code in returned_codes:
            code.status = 'available'
            code.order  = None
            code.save(update_fields=['status', 'order'])

        user = locked.user
        refund = locked.amount_paid
        user.balance += refund
        # Reverse the points movement: take back points earned on this order,
        # give back points the client redeemed on it. Clamp at 0 in case the
        # earned points were already spent elsewhere.
        points_delta = locked.points_used - locked.points_earned
        user.points = max(0, user.points + points_delta)
        user.save(update_fields=['balance', 'points'])

        WalletTransaction.objects.create(
            user=user, type='credit', amount=refund,
            method='refund', note=f'Cancelled Order #{locked.id} - code not revealed'
        )
        if points_delta != 0:
            WalletTransaction.objects.create(
                user=user, type='credit' if points_delta > 0 else 'debit', amount=0,
                method='points',
                note=f'Points adjustment for cancelled order #{locked.id}: '
                     f'{-locked.points_earned:+d} earned reversed, {locked.points_used:+d} redeemed returned'
            )

        locked.status = Order.Status.CANCELLED
        locked.code   = None
        locked.save(update_fields=['status', 'code'])

        # Update stock count
        if locked.product:
            from apps.products.models import Product
            Product.objects.filter(pk=locked.product_id).update(
                stock_count=models.F('stock_count') + max(len(returned_codes), 1)
            )

    return Response(OrderSerializer(locked, context={'request': request}).data)


# ── Promo ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_promo(request):
    code_str = request.data.get('code', '').strip().upper()
    price    = request.data.get('price', 0)

    if not code_str:
        return Response({'detail': 'Code is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        promo = PromoCode.objects.get(code=code_str)
    except PromoCode.DoesNotExist:
        return Response({'detail': 'Invalid promo code.'}, status=status.HTTP_400_BAD_REQUEST)

    valid, err = promo.check_valid(user=request.user)
    if not valid:
        return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

    discount = promo.calculate_discount(float(price))
    return Response({
        'code':            promo.code,
        'discount_type':   promo.discount_type,
        'discount_value':  str(promo.discount_value),
        'discount_amount': discount,
    })


# ── Reorder ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reorder(request, pk):
    try:
        original = Order.objects.get(pk=pk, user=request.user, status=Order.Status.COMPLETED)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not original.product:
        return Response({'detail': 'Bundle reorders are not supported.'}, status=status.HTTP_400_BAD_REQUEST)

    product     = original.product
    user        = request.user
    subtotal    = Decimal(str(product.effective_price))
    service_fee = (subtotal * SERVICE_FEE_RATE).quantize(Decimal('0.01'))
    price       = float(subtotal + service_fee)
    points_rate = getattr(settings, 'POINTS_RATE', 1)

    if user.balance < price:
        return Response({'detail': f'Insufficient balance. Need {price:.2f} DT, have {float(user.balance):.2f} DT.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        code = Code.objects.select_for_update().filter(product=product, status='available').first()
        if not code:
            return Response({'detail': 'Product is out of stock.'}, status=status.HTTP_400_BAD_REQUEST)

        points_earned = product.points_earned if product.points_earned > 0 else _points_from_amount(subtotal, points_rate)
        user.balance -= price
        user.points  += points_earned
        user.save()

        code.status = 'sold'
        unit_cost = get_effective_cost(product, None)
        order = Order.objects.create(
            user=user, product=product,
            amount_paid=price, service_fee=service_fee,
            points_earned=points_earned,
            status=Order.Status.COMPLETED,
            cost_price_at_sale=unit_cost,
            profit_at_sale=(Decimal(str(price)) - unit_cost) if unit_cost is not None else None,
        )
        code.order = order
        code.save()
        order.code = code
        order.save()

        product.stock_count = max(0, product.stock_count - 1)
        product.save()

        WalletTransaction.objects.create(
            user=user, type='debit', amount=price,
            method='wallet', note=f'Reorder: {product.name}'
        )

    try:
        from apps.orders.tasks import send_order_confirmation_email
        _fire(send_order_confirmation_email.delay, order.id)
    except Exception:
        pass

    return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


# ── Admin: Promo Code CRUD ─────────────────────────────────────────────────

class AdminPromoCodeListView(generics.ListCreateAPIView):
    serializer_class   = PromoCodeSerializer
    permission_classes = [IsAdmin]
    queryset           = PromoCode.objects.all()


class AdminPromoCodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = PromoCodeSerializer
    permission_classes = [IsAdmin]
    queryset           = PromoCode.objects.all()

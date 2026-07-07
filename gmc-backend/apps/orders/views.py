import uuid
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction, models
from django.db.models import Prefetch
from django.conf import settings
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
from .models import Order, PromoCode, OrderCredentials, OrderCodeViewLog
from .serializers import OrderSerializer, PlaceOrderSerializer, PromoCodeSerializer, OrderCredentialsSerializer
from apps.products.models import Product, Code, Bundle, ProductVariant
from apps.users.models import WalletTransaction
from apps.users.permissions import IsAdmin
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
    (code, bundle, promo_code, variant, user->conversation, credentials), and
    a Prefetch for the embedded product card so the nested ProductSerializer
    reuses the annotated/variant-prefetched product instead of firing its own
    ~5 queries per order.
    """
    return Order.objects.select_related(
        'code', 'bundle', 'promo_code', 'variant',
        'user__conversation', 'credentials',
    ).prefetch_related(
        Prefetch('product', queryset=Product.objects.select_related('category').with_card_data())
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


def _push_chat_message(conv_id, msg):
    """Fire-and-forget WebSocket broadcast to a chat group."""
    import threading
    def _send():
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            layer = get_channel_layer()
            if layer is None:
                return
            async_to_sync(layer.group_send)(f'chat_{conv_id}', {
                'type':           'chat_message',
                'id':             msg.id,
                'body':           msg.body,
                'sender_id':      msg.sender_id,
                'sender_name':    msg.sender.username,
                'msg_type':       msg.msg_type,
                'metadata':       msg.metadata,
                'attachment_url': None,
                'created_at':     msg.created_at.isoformat(),
                'status':         'sent',
            })
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


def _auto_open_order_chat(order):
    """
    Ensure a Conversation exists for the user, then auto-send:
      1. order_card        - order summary
      2. credentials_card  - locked card (no plaintext)
    Returns the conversation.
    """
    from apps.chat.models import Conversation, Message
    from apps.users.models import User

    conv, _ = Conversation.objects.get_or_create(client=order.user)

    product_name = order.product.name if order.product else (
        order.bundle.name if order.bundle else 'Unknown'
    )

    admin  = User.objects.filter(role='admin').first()
    sender = admin or order.user

    # 1. Order card
    order_msg = Message.objects.create(
        conversation=conv,
        sender=sender,
        body=f'New order #{order.id} - {product_name}',
        msg_type='order_card',
        metadata={
            'order_id':     order.id,
            'product_name': product_name,
            'amount_paid':  str(order.amount_paid),
            'status':       order.status,
        },
        status='sent',
    )
    _push_chat_message(conv.id, order_msg)

    # 2. Credentials card (reference only - no plaintext ever sent)
    if hasattr(order, 'credentials'):
        cred_msg = Message.objects.create(
            conversation=conv,
            sender=order.user,
            body='🔒 Credentials shared securely',
            msg_type='credentials_card',
            metadata={
                'order_id':   order.id,
                'visible_to': 'admin',
            },
            status='sent',
        )
        _push_chat_message(conv.id, cred_msg)

    conv.last_message_at = timezone.now()
    conv.unread_count   += 1
    conv.save(update_fields=['last_message_at', 'unread_count'])

    # Notify admin notification group (fire-and-forget, don't block response)
    import threading
    def _notify_admin():
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            layer = get_channel_layer()
            if layer is None:
                return
            async_to_sync(layer.group_send)('admin_notifications', {
                'type':            'new_message_notification',
                'conversation_id': conv.id,
                'body':            f'New order #{order.id} requires credentials delivery',
                'sender_id':       order.user.id,
                'sender_name':     order.user.username,
                'created_at':      timezone.now().isoformat(),
            })
        except Exception:
            pass
    threading.Thread(target=_notify_admin, daemon=True).start()

    return conv


def _post_status_chat_message(order, new_status, note=''):
    """Post a status_update message to the order's chat thread and broadcast it."""
    STATUS_MESSAGES = {
        'in_progress': '🔄 Service started - we are working on your order.',
        'completed':   '✅ Service completed! Please verify and confirm delivery below.',
    }
    body = STATUS_MESSAGES.get(new_status, f'Status updated to {new_status}.')
    if note:
        body += f'\n\n"{note}"'

    try:
        from apps.chat.models import Conversation, Message
        from apps.users.models import User
        conv  = Conversation.objects.get(client=order.user)
        admin = User.objects.filter(role='admin').first()
        if not admin:
            return
        msg = Message.objects.create(
            conversation=conv,
            sender=admin,
            body=body,
            msg_type='status_update',
            metadata={'order_id': order.id, 'service_status': new_status},
            status='sent',
        )
        conv.last_message_at = timezone.now()
        conv.unread_count   += 1
        conv.save(update_fields=['last_message_at', 'unread_count'])
        _push_chat_message(conv.id, msg)
    except Exception:
        pass


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
            valid, err = promo_obj.check_valid()
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

                WalletTransaction.objects.create(
                    user=user, type='debit', amount=final_price,
                    method='wallet', note=f'Bundle purchase: {bundle.name}'
                )

            try:
                from apps.orders.tasks import send_order_confirmation_email
                _fire(send_order_confirmation_email.delay, order.id)
            except Exception:
                pass

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

            batch_id = uuid.uuid4() if quantity > 1 else None

            orders = []
            for i in range(quantity):
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
                        batch_id=batch_id,
                    )
                else:
                    order = Order.objects.create(
                        user=user, product=product,
                        variant=selected_variant,
                        amount_paid=final_price,
                        service_fee=service_fee,
                        discount_amount=promo_discount,
                        points_earned=points_earned,
                        # A single purchase's redeemed points apply to quantity=1 only
                        points_used=points_to_use if i == 0 else 0,
                        promo_code=promo_obj,
                        status=Order.Status.COMPLETED,
                        escrow_held=False,
                        requires_account=False,
                        service_status='pending',
                        batch_id=batch_id,
                    )

                if codes:
                    code = codes[i]
                    code.status = 'sold'
                    code.order  = order
                    code.save()
                    order.code = code
                    order.save()

                orders.append(order)

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

            WalletTransaction.objects.create(
                user=user, type='debit', amount=total_price,
                method='wallet',
                note=f'Purchase: {product.name}' + (f' x{quantity}' if quantity > 1 else ''),
            )
            if points_earned > 0:
                WalletTransaction.objects.create(
                    user=user, type='credit', amount=0,
                    method='points', note=f'Points earned: {points_earned * quantity} for order #{orders[0].id}'
                )

            if needs_credentials and credentials:
                creds = OrderCredentials(order=orders[0])
                creds.set_data(credentials)
                creds.save()

        order = orders[0]

        # Auto-open chat for credential orders
        if needs_credentials:
            try:
                _auto_open_order_chat(order)
            except Exception:
                pass
            # The encrypted payload is purged when the buyer confirms delivery
            # (see confirm_delivery), in the same transaction as the escrow release.

        try:
            from apps.orders.tasks import send_order_confirmation_email
            for o in orders:
                _fire(send_order_confirmation_email.delay, o.id)
        except Exception:
            pass

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

        if quantity > 1:
            return Response(
                {'orders': OrderSerializer(orders, many=True).data, 'count': quantity},
                status=status.HTTP_201_CREATED,
            )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _order_list_queryset().filter(user=self.request.user)


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

    if new_status != old_status and new_status in ('in_progress', 'completed'):
        _post_status_chat_message(order, new_status, note)

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

    # Archive chat thread (mark read-only via conversation status)
    try:
        from apps.chat.models import Conversation, Message
        from apps.users.models import User as _User
        conv = Conversation.objects.get(client=order.user)
        conv.status = 'resolved'
        conv.save(update_fields=['status'])

        admin = _User.objects.filter(role='admin').first()
        if admin:
            msg = Message.objects.create(
                conversation=conv,
                sender=admin,
                body='✅ Order closed. Credentials have been securely deleted. Thank you!',
                msg_type='status_update',
                metadata={'order_id': order.id, 'service_status': 'closed'},
                status='sent',
            )
            _push_chat_message(conv.id, msg)
    except Exception:
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

    # Post dispute message in chat thread
    try:
        from apps.chat.models import Conversation, Message
        from apps.users.models import User
        conv = Conversation.objects.get(client=order.user)
        # Escalate conversation priority
        conv.priority = 'urgent'
        conv.save(update_fields=['priority'])

        admin = User.objects.filter(role='admin').first()
        if admin:
            body = f'⚠️ Dispute opened by buyer.'
            if reason:
                body += f'\n\nReason: "{reason}"'
            body += '\n\nEscrow is held. An admin will review this order.'
            msg = Message.objects.create(
                conversation=conv,
                sender=order.user,
                body=body,
                msg_type='status_update',
                metadata={'order_id': order.id, 'service_status': 'disputed'},
                status='sent',
            )
            _push_chat_message(conv.id, msg)
    except Exception:
        pass

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
        order = Order.objects.select_related('code').get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not order.code:
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
        'code':             order.code.code,
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

        code = locked.code
        if code:
            code.status = 'available'
            code.save(update_fields=['status'])

        user = locked.user
        refund = locked.amount_paid
        user.balance += refund
        user.save(update_fields=['balance'])

        WalletTransaction.objects.create(
            user=user, type='credit', amount=refund,
            method='refund', note=f'Cancelled Order #{locked.id} - code not revealed'
        )

        locked.status = Order.Status.CANCELLED
        locked.code   = None
        locked.save(update_fields=['status', 'code'])

        # Update stock count
        if locked.product:
            from apps.products.models import Product
            Product.objects.filter(pk=locked.product_id).update(
                stock_count=models.F('stock_count') + 1
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

    valid, err = promo.check_valid()
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
        order = Order.objects.create(
            user=user, product=product,
            amount_paid=price, service_fee=service_fee,
            points_earned=points_earned,
            status=Order.Status.COMPLETED,
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

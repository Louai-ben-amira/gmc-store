import io
import base64
import threading
from decimal import Decimal
from datetime import timedelta

from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from config.throttles import RechargeRateThrottle

from .models import RechargeRequest, CryptoPayment, SiteSettings, GiftCardBatch, GiftCard
from apps.products.models import Product, Category, Code as ProductCode
from .serializers import (
    RechargeRequestSerializer, RechargePreviewSerializer,
    CryptoPaymentSerializer, InitiateCryptoSerializer,
    SiteSettingsSerializer,
    GiftCardBatchSerializer, GiftCardSerializer, CreateGiftCardBatchSerializer,
    TICKET_METHODS, D17_METHODS,
)
from apps.users.permissions import IsAdmin


# ── Payment methods info ───────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payment_methods(request):
    """Return all available payment methods with their current config from SiteSettings."""
    tax_rate_str = SiteSettings.get('TICKET_TAX_RATE', '0.11')
    try:
        tax_rate = float(tax_rate_str)
    except ValueError:
        tax_rate = 0.11

    phone_enabled        = SiteSettings.get('D17_PHONE_ENABLED',        'true').lower() == 'true'
    address_enabled      = SiteSettings.get('D17_ADDRESS_ENABLED',      'true').lower() == 'true'
    bank_enabled         = SiteSettings.get('BANK_TRANSFER_ENABLED',    'true').lower() == 'true'
    flouci_enabled       = SiteSettings.get('FLOUCI_ENABLED',           'true').lower() == 'true'

    return Response({
        'ooredoo_ticket': {
            'label':        'Ooredoo Ticket',
            'type':         'ticket',
            'tax_rate':     tax_rate,
            'instructions': SiteSettings.get('OOREDOO_INSTRUCTIONS'),
        },
        'orange_ticket': {
            'label':        'Orange Ticket',
            'type':         'ticket',
            'tax_rate':     tax_rate,
            'instructions': SiteSettings.get('ORANGE_INSTRUCTIONS'),
        },
        'd17_number': {
            'label':    'D17 — Phone',
            'type':     'transfer',
            'enabled':  phone_enabled,
            'value':    SiteSettings.get('D17_PHONE_NUMBER'),
            'numbers':  [n for n in [
                SiteSettings.get('D17_PHONE_NUMBER'),
                SiteSettings.get('D17_PHONE_NUMBER_2'),
                SiteSettings.get('D17_PHONE_NUMBER_3'),
            ] if n],
            'tax_rate': 0.01,
            'flat_fee': 0,
        },
        'd17_address': {
            'label':         'D17 — Address/RIB',
            'type':          'transfer',
            'enabled':       address_enabled,
            'value':         SiteSettings.get('D17_ADDRESS'),
            'address_label': SiteSettings.get('D17_ADDRESS_LABEL', 'D17 Account Address'),
            'tax_rate':      0,
            'flat_fee':      0,
        },
        'bank_transfer': {
            'label':        'Bank Transfer',
            'type':         'transfer',
            'enabled':      bank_enabled,
            'value':        SiteSettings.get('BANK_ACCOUNT_NUMBER'),
            'bank_name':    SiteSettings.get('BANK_ACCOUNT_NAME'),
            'instructions': SiteSettings.get('BANK_TRANSFER_INSTRUCTIONS'),
            'tax_rate':     0,
            'flat_fee':     2.5,
        },
        'flouci': {
            'label':        'Flouci',
            'type':         'transfer',
            'enabled':      flouci_enabled,
            'value':        SiteSettings.get('FLOUCI_PHONE_NUMBER'),
            'instructions': SiteSettings.get('FLOUCI_INSTRUCTIONS'),
            'tax_rate':     0,
            'flat_fee':     0,
        },
    })


# ── Recharge preview (no DB write) ────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def recharge_preview(request):
    """Return live credit preview — no DB write, pure calculation."""
    serializer = RechargePreviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data   = serializer.validated_data
    method = data['method']

    TRANSFER_METHODS_LOCAL = {'d17_number', 'd17_address', 'bank_transfer', 'flouci'}
    if method in TICKET_METHODS:
        tax_str = SiteSettings.get('TICKET_TAX_RATE', '0.11')
        try:
            tax_rate = Decimal(tax_str)
        except Exception:
            tax_rate = Decimal('0.11')
        base          = data['ticket_value']
        tax_amount    = (base * tax_rate).quantize(Decimal('0.01'))
        wallet_credit = (base - tax_amount).quantize(Decimal('0.01'))
        return Response({
            'tax_rate':     float(tax_rate),
            'tax_amount':   float(tax_amount),
            'wallet_credit': float(wallet_credit),
        })
    elif method in TRANSFER_METHODS_LOCAL:
        amount = data['amount_sent']
        if method == 'bank_transfer':
            flat_fee      = Decimal('2.5')
            tax_amount    = flat_fee
            wallet_credit = max(amount - flat_fee, Decimal('0')).quantize(Decimal('0.01'))
            return Response({'tax_rate': 0, 'tax_amount': float(tax_amount), 'wallet_credit': float(wallet_credit)})
        elif method == 'd17_number':
            pct           = Decimal('0.01')
            fee           = (amount * pct).quantize(Decimal('0.01'))
            total_to_send = (amount + fee).quantize(Decimal('0.01'))
            return Response({'tax_rate': float(pct), 'tax_amount': float(fee), 'wallet_credit': float(amount), 'total_to_send': float(total_to_send)})
        else:
            return Response({'tax_rate': 0, 'tax_amount': 0, 'wallet_credit': float(amount)})
    else:
        return Response({'tax_rate': 0, 'tax_amount': 0, 'wallet_credit': 0})


# ── Recharge submit ────────────────────────────────────────────────────────

class RechargeCreateView(generics.CreateAPIView):
    serializer_class   = RechargeRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes   = [RechargeRateThrottle]

    def perform_create(self, serializer):
        recharge = serializer.save(user=self.request.user)

        def _notify():
            try:
                from apps.payments.tasks import send_telegram_alert
                method_label = recharge.get_method_display()
                if recharge.method in TICKET_METHODS:
                    detail = f"🎫 Ticket {recharge.ticket_value} DT → credit {recharge.wallet_credit} DT"
                else:
                    detail = f"💸 Sent {recharge.amount_sent} DT → credit {recharge.wallet_credit} DT"
                send_telegram_alert.delay(
                    f"💸 <b>New Recharge #{recharge.id}</b>\n"
                    f"👤 {recharge.user.username}\n"
                    f"💳 {method_label}\n"
                    f"{detail}\n"
                    f"🔗 Review in admin panel"
                )
            except Exception:
                pass

        threading.Thread(target=_notify, daemon=True).start()


# ── Admin: list recharges ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_recharge_list(request):
    qs = RechargeRequest.objects.select_related('user', 'reviewed_by').exclude(method='crypto')
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    serializer = RechargeRequestSerializer(qs, many=True)
    return Response(serializer.data)


# ── Admin: approve ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_recharge_approve(request, pk):
    """Approve a recharge: credit wallet_credit atomically and log transaction."""
    try:
        recharge = RechargeRequest.objects.select_related('user').get(pk=pk)
    except RechargeRequest.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if recharge.status != 'pending':
        return Response({'detail': f'Recharge is already {recharge.status}.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.users.models import WalletTransaction

    with db_transaction.atomic():
        recharge.status      = 'approved'
        recharge.admin_note  = request.data.get('admin_note', '')
        recharge.reviewed_at = timezone.now()
        recharge.reviewed_by = request.user
        recharge.save(update_fields=['status', 'admin_note', 'reviewed_at', 'reviewed_by'])

        user = recharge.user
        user.balance += recharge.wallet_credit
        user.save(update_fields=['balance'])

        WalletTransaction.objects.create(
            user          = user,
            type          = 'credit',
            amount        = recharge.wallet_credit,
            balance_after = user.balance,
            method        = recharge.method,
            note          = recharge.wallet_credit_description(),
        )

    try:
        from apps.payments.tasks import send_recharge_approved_email
        send_recharge_approved_email.delay(recharge.id)
    except Exception:
        pass

    return Response({'detail': 'Approved and balance credited.', 'wallet_credit': str(recharge.wallet_credit)})


# ── Admin: reject ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_recharge_reject(request, pk):
    """Reject a recharge — admin_note is required to explain why."""
    try:
        recharge = RechargeRequest.objects.get(pk=pk)
    except RechargeRequest.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if recharge.status != 'pending':
        return Response({'detail': f'Recharge is already {recharge.status}.'}, status=status.HTTP_400_BAD_REQUEST)

    admin_note = request.data.get('admin_note', '').strip()
    if not admin_note:
        return Response({'detail': 'admin_note is required when rejecting.'}, status=status.HTTP_400_BAD_REQUEST)

    recharge.status      = 'rejected'
    recharge.admin_note  = admin_note
    recharge.reviewed_at = timezone.now()
    recharge.reviewed_by = request.user
    recharge.save(update_fields=['status', 'admin_note', 'reviewed_at', 'reviewed_by'])

    return Response({'detail': 'Rejected.'})


# ── Crypto payments ────────────────────────────────────────────────────────

MOCK_RATES_DT = {
    'BINANCE': Decimal('3.1'),
    'BNB':     Decimal('1860'),
}


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def initiate_crypto(request):
    serializer = InitiateCryptoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    currency  = serializer.validated_data['currency']
    amount_dt = serializer.validated_data['amount_dt']

    wallet_address = CryptoPayment.get_wallet_address(currency)
    if not wallet_address:
        return Response(
            {'detail': f'No wallet address configured for {currency}. Contact admin.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    rate          = MOCK_RATES_DT.get(currency, Decimal('1'))
    amount_crypto = (amount_dt / rate).quantize(Decimal('0.00000001'))
    expires_at    = timezone.now() + timedelta(minutes=30)

    recharge = RechargeRequest.objects.create(
        user=request.user,
        method='crypto',
        amount_sent=amount_dt,
        wallet_credit=amount_dt,
        status='pending',
    )

    crypto = CryptoPayment.objects.create(
        recharge_request=recharge,
        currency=currency,
        wallet_address=wallet_address,
        amount_crypto=amount_crypto,
        amount_dt=amount_dt,
        exchange_rate=rate,
        expires_at=expires_at,
        status='pending',
    )

    def _notify_crypto(rid, uname, adt, cur, acr):
        try:
            from apps.payments.tasks import send_telegram_alert
            send_telegram_alert.delay(
                f"💸 <b>Crypto Recharge #{rid}</b>\n"
                f"👤 {uname}\n"
                f"💰 {adt} DT via {cur}\n"
                f"₿ {acr} {cur}"
            )
        except Exception:
            pass

    threading.Thread(target=_notify_crypto, args=(recharge.id, request.user.username, amount_dt, currency, amount_crypto), daemon=True).start()

    return Response(CryptoPaymentSerializer(crypto).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def crypto_qr(request, pk):
    try:
        crypto = CryptoPayment.objects.select_related('recharge_request').get(
            pk=pk, recharge_request__user=request.user
        )
    except CryptoPayment.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        import qrcode
        img = qrcode.make(crypto.wallet_address)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        data_uri = 'data:image/png;base64,' + base64.b64encode(buf.read()).decode()
        return Response({'qr': data_uri, 'address': crypto.wallet_address})
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def submit_tx_hash(request, pk):
    try:
        crypto = CryptoPayment.objects.select_related('recharge_request').get(
            pk=pk, recharge_request__user=request.user
        )
    except CryptoPayment.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if crypto.is_expired:
        crypto.status = 'expired'
        crypto.save(update_fields=['status'])
        return Response({'detail': 'Payment expired. Please create a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    tx_hash = request.data.get('tx_hash', '').strip()
    if not tx_hash:
        return Response({'detail': 'tx_hash is required.'}, status=status.HTTP_400_BAD_REQUEST)

    crypto.tx_hash = tx_hash
    crypto.status  = 'confirming'
    crypto.save(update_fields=['tx_hash', 'status'])

    def _notify_tx(rid, uname, adt, cur, txh):
        try:
            from apps.payments.tasks import send_telegram_alert
            send_telegram_alert.delay(
                f"🔔 <b>Crypto TX submitted #{rid}</b>\n"
                f"👤 {uname}\n💰 {adt} DT — {cur}\n"
                f"🔗 TX: <code>{txh}</code>"
            )
        except Exception:
            pass

    threading.Thread(target=_notify_tx, args=(crypto.recharge_request.id, request.user.username, crypto.amount_dt, crypto.currency, tx_hash), daemon=True).start()

    return Response(CryptoPaymentSerializer(crypto).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_crypto_payments(request):
    qs = CryptoPayment.objects.filter(
        recharge_request__user=request.user
    ).select_related('recharge_request').order_by('-created_at')
    return Response(CryptoPaymentSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_crypto_list(request):
    qs = CryptoPayment.objects.select_related('recharge_request__user').order_by('-created_at')
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(CryptoPaymentSerializer(qs, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAdmin])
def admin_crypto_action(request, pk):
    try:
        crypto = CryptoPayment.objects.select_related('recharge_request__user').get(pk=pk)
    except CryptoPayment.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    action     = request.data.get('action')
    admin_note = request.data.get('admin_note', '')
    tx_hash    = request.data.get('tx_hash', '').strip()

    if crypto.status in ('confirmed', 'expired') and action in ('approve', 'reject'):
        return Response({'detail': 'Payment is already finalized.'}, status=status.HTTP_400_BAD_REQUEST)

    if action == 'approve':
        from apps.users.models import WalletTransaction

        with db_transaction.atomic():
            recharge = crypto.recharge_request
            user     = recharge.user

            recharge.status      = 'approved'
            recharge.admin_note  = admin_note
            recharge.reviewed_at = timezone.now()
            recharge.reviewed_by = request.user
            recharge.save()

            crypto.status = 'confirmed'
            if tx_hash:
                crypto.tx_hash = tx_hash
            crypto.save(update_fields=['status', 'tx_hash'])

            user.balance += recharge.wallet_credit
            user.save(update_fields=['balance'])

            WalletTransaction.objects.create(
                user=user, type='credit', amount=recharge.wallet_credit,
                balance_after=user.balance,
                method='crypto',
                note=f'Crypto recharge #{recharge.id} approved — {crypto.currency}',
            )

        try:
            from apps.payments.tasks import send_recharge_approved_email
            send_recharge_approved_email.delay(recharge.id)
        except Exception:
            pass

        return Response({'detail': 'Approved and balance credited.'})

    elif action == 'reject':
        recharge             = crypto.recharge_request
        recharge.status      = 'rejected'
        recharge.admin_note  = admin_note
        recharge.reviewed_at = timezone.now()
        recharge.reviewed_by = request.user
        recharge.save()

        crypto.status = 'expired'
        crypto.save(update_fields=['status'])

        return Response({'detail': 'Rejected.'})

    return Response({'detail': 'action must be approve or reject.'}, status=status.HTTP_400_BAD_REQUEST)


# ── Public hero slides ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_hero_slides(request):
    value = SiteSettings.get('HERO_SLIDES', '[]')
    try:
        import json
        slides = json.loads(value)
    except Exception:
        slides = []
    return Response({'slides': slides})


# ── Site Settings (admin) ──────────────────────────────────────────────────

class SiteSettingsListView(generics.ListCreateAPIView):
    serializer_class   = SiteSettingsSerializer
    permission_classes = [IsAdmin]
    queryset           = SiteSettings.objects.all()
    pagination_class   = None


class SiteSettingsDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = SiteSettingsSerializer
    permission_classes = [IsAdmin]
    queryset           = SiteSettings.objects.all()


# ── Hero image upload ──────────────────────────────────────────────────────

import os
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def redeem_gift_card(request):
    """Client redeems a gift card code — instantly credits wallet."""
    code_str = request.data.get('code', '').strip().upper()
    if not code_str:
        return Response({'detail': 'code is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.users.models import WalletTransaction
    from django.utils import timezone as tz

    # select_for_update prevents race conditions on concurrent redeem
    with db_transaction.atomic():
        try:
            card = GiftCard.objects.select_for_update().select_related('batch').get(code=code_str)
        except GiftCard.DoesNotExist:
            return Response({'detail': 'Invalid gift card code.'}, status=status.HTTP_404_NOT_FOUND)

        if card.is_used:
            return Response({'detail': 'This code has already been redeemed.'}, status=status.HTTP_400_BAD_REQUEST)

        if card.is_expired:
            return Response({'detail': 'This gift card has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        amount = card.batch.amount
        card.redeemed_by = request.user
        card.redeemed_at = tz.now()
        card.save(update_fields=['redeemed_by', 'redeemed_at'])

        user = request.user
        user.balance += amount
        user.save(update_fields=['balance'])

        WalletTransaction.objects.create(
            user          = user,
            type          = 'credit',
            amount        = amount,
            balance_after = user.balance,
            method        = 'gift_card',
            note          = f'GMC Gift Card redeemed — {code_str}',
        )

    return Response({
        'detail': f'+{amount} DT credited to your wallet.',
        'amount': str(amount),
        'balance': str(user.balance),
    })


# ── Admin: gift card batches ───────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin])
def admin_gift_card_batches(request):
    import secrets
    if request.method == 'GET':
        batches = GiftCardBatch.objects.all()
        return Response(GiftCardBatchSerializer(batches, many=True, context={'request': request}).data)

    serializer = CreateGiftCardBatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    with db_transaction.atomic():
        label = data.get('label', '') or f"GMC Gift Card {data['amount']} DT"
        image = request.FILES.get('image')

        # Generate unique codes
        codes_raw = []
        for _ in range(data['quantity']):
            code = 'GMC-' + secrets.token_hex(6).upper()
            while GiftCard.objects.filter(code=code).exists() or code in codes_raw:
                code = 'GMC-' + secrets.token_hex(6).upper()
            codes_raw.append(code)

        # Auto-create a Product so the gift card appears in the shop
        gift_cats = Category.objects.filter(slug='gift-cards').first()
        product = Product.objects.create(
            name        = label,
            price       = data['amount'],
            image       = image,
            category    = gift_cats,
            stock_count = data['quantity'],
            visible     = True,
            description = 'GMC Store gift card. Redeem the code in your wallet to credit your balance.',
        )

        batch = GiftCardBatch.objects.create(
            label          = label,
            amount         = data['amount'],
            quantity       = data['quantity'],
            expires_at     = data.get('expires_at'),
            created_by     = request.user,
            image          = image,
            linked_product = product,
        )

        # Create GiftCard rows + matching Code rows (used by order fulfillment)
        gift_cards = [GiftCard(batch=batch, code=c) for c in codes_raw]
        GiftCard.objects.bulk_create(gift_cards)
        ProductCode.objects.bulk_create([ProductCode(product=product, code=c) for c in codes_raw])

    return Response(GiftCardBatchSerializer(batch, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdmin])
def admin_gift_card_batch_detail(request, pk):
    try:
        batch = GiftCardBatch.objects.get(pk=pk)
    except GiftCardBatch.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if batch.linked_product:
            batch.linked_product.delete()   # cascades to Code objects
        batch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — update label and/or image, keep linked product in sync
    if 'label' in request.data:
        batch.label = request.data['label']
    if 'image' in request.FILES:
        batch.image = request.FILES['image']
    batch.save()

    if batch.linked_product:
        p = batch.linked_product
        if 'label' in request.data:
            p.name = batch.label
        if 'image' in request.FILES:
            p.image = batch.image
        # Keep stock_count = number of unredeemed codes
        p.stock_count = batch.cards.filter(redeemed_by__isnull=True).count()
        p.save(update_fields=['name', 'image', 'stock_count'])

    return Response(GiftCardBatchSerializer(batch, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_gift_card_batch_codes(request, pk):
    try:
        batch = GiftCardBatch.objects.get(pk=pk)
    except GiftCardBatch.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    cards = batch.cards.select_related('redeemed_by').all()
    return Response(GiftCardSerializer(cards, many=True).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def upload_hero_image(request):
    """Upload a hero slide image, return its public URL."""
    img = request.FILES.get('image')
    if not img:
        return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)

    ext      = os.path.splitext(img.name)[1].lower() or '.jpg'
    filename = f'hero_slides/{timezone.now().strftime("%Y%m%d_%H%M%S")}_{img.name}'
    path     = default_storage.save(filename, ContentFile(img.read()))
    url      = request.build_absolute_uri(default_storage.url(path))
    return Response({'url': url})

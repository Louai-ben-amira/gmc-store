import json
from decimal import Decimal, InvalidOperation
from rest_framework import serializers
from . import hero
from .models import RechargeRequest, RechargeTicketItem, CryptoPayment, SiteSettings, GiftCardBatch, GiftCard


TICKET_METHODS   = {'ooredoo_ticket', 'orange_ticket'}
D17_METHODS      = {'d17_number', 'd17_address'}
TRANSFER_METHODS = {'d17_number', 'd17_address', 'bank_transfer', 'edinar', 'flouci'}


class RechargeTicketItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RechargeTicketItem
        fields = ['id', 'code', 'value', 'credit']
        read_only_fields = ['id', 'code', 'value', 'credit']


class RechargeRequestSerializer(serializers.ModelSerializer):
    user_username        = serializers.CharField(source='user.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    # Computed breakdown fields - read-only, always server-side
    tax_rate      = serializers.DecimalField(max_digits=5, decimal_places=4, read_only=True)
    wallet_credit = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    ticket_items = RechargeTicketItemSerializer(many=True, read_only=True)
    # Write-only: JSON string of [{code, value}, ...] for ticket methods (multipart-safe)
    tickets = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model  = RechargeRequest
        fields = [
            'id', 'user', 'user_username',
            'method',
            'ticket_code', 'ticket_value', 'ticket_items', 'tickets',
            'amount_sent', 'reference_code',
            'tax_rate', 'wallet_credit',
            'proof', 'status', 'admin_note',
            'reviewed_at', 'reviewed_by', 'reviewed_by_username',
            'created_at',
        ]
        read_only_fields = [
            'id', 'user', 'ticket_code', 'ticket_value', 'tax_rate', 'wallet_credit',
            'status', 'admin_note', 'reviewed_at', 'reviewed_by', 'created_at',
        ]

    def validate(self, attrs):
        method = attrs.get('method', '')

        if method in TICKET_METHODS:
            raw = attrs.get('tickets', '')
            try:
                items = json.loads(raw) if raw else []
            except (TypeError, ValueError):
                raise serializers.ValidationError({'tickets': 'Invalid ticket list.'})

            if not isinstance(items, list) or not items:
                raise serializers.ValidationError({'tickets': 'At least one ticket code is required.'})

            seen_codes = set()
            parsed = []
            for item in items:
                code  = str(item.get('code', '')).strip()
                value = item.get('value')
                if not code:
                    raise serializers.ValidationError({'tickets': 'Every ticket needs a code.'})
                try:
                    value = Decimal(str(value))
                except (TypeError, InvalidOperation):
                    value = None
                if value is None or value <= 0:
                    raise serializers.ValidationError({'tickets': f'Ticket "{code}" needs a value greater than 0.'})
                if code in seen_codes:
                    raise serializers.ValidationError({'tickets': f'Ticket code "{code}" was submitted twice.'})
                seen_codes.add(code)
                parsed.append({'code': code, 'value': value})

            if RechargeTicketItem.objects.filter(code__in=seen_codes).exists():
                raise serializers.ValidationError(
                    {'tickets': 'One or more of these ticket codes has already been submitted.'}
                )

            attrs['_parsed_tickets'] = parsed

        elif method in TRANSFER_METHODS:
            amount_sent = attrs.get('amount_sent')
            if amount_sent is None or amount_sent <= 0:
                raise serializers.ValidationError({'amount_sent': 'Amount sent must be greater than 0.'})
            if not attrs.get('reference_code', '').strip():
                raise serializers.ValidationError({'reference_code': 'Transaction reference number is required.'})

        return attrs

    def create(self, validated_data):
        parsed_tickets = validated_data.pop('_parsed_tickets', None)
        validated_data.pop('tickets', None)

        request = RechargeRequest.objects.create(**validated_data)

        if parsed_tickets:
            RechargeTicketItem.objects.bulk_create([
                RechargeTicketItem(request=request, code=t['code'], value=t['value'])
                for t in parsed_tickets
            ])
            request.save(update_fields=['tax_rate', 'wallet_credit'])

        return request


class RechargePreviewSerializer(serializers.Serializer):
    method       = serializers.ChoiceField(choices=RechargeRequest.METHOD_CHOICES)
    ticket_value = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    amount_sent  = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)

    def validate(self, attrs):
        method = attrs['method']
        if method in TICKET_METHODS and not attrs.get('ticket_value'):
            raise serializers.ValidationError({'ticket_value': 'ticket_value is required for ticket methods.'})
        if method in TRANSFER_METHODS and not attrs.get('amount_sent'):
            raise serializers.ValidationError({'amount_sent': 'amount_sent is required for transfer methods.'})
        return attrs


class CryptoPaymentSerializer(serializers.ModelSerializer):
    is_expired    = serializers.BooleanField(read_only=True)
    user_id       = serializers.IntegerField(source='recharge_request.user.id',       read_only=True)
    user_username = serializers.CharField(source='recharge_request.user.username',    read_only=True)
    user_email    = serializers.CharField(source='recharge_request.user.email',       read_only=True)
    user_balance  = serializers.DecimalField(source='recharge_request.user.balance',  max_digits=10, decimal_places=2, read_only=True)
    wallet_credit = serializers.DecimalField(source='recharge_request.wallet_credit', max_digits=10, decimal_places=2, read_only=True)
    recharge_id   = serializers.IntegerField(source='recharge_request.id',            read_only=True)

    class Meta:
        model  = CryptoPayment
        fields = [
            'id', 'recharge_id', 'recharge_request',
            'user_id', 'user_username', 'user_email', 'user_balance',
            'currency', 'wallet_address',
            'amount_crypto', 'amount_dt', 'wallet_credit', 'exchange_rate',
            'tx_hash', 'status', 'expires_at', 'is_expired', 'created_at',
        ]
        read_only_fields = [
            'id', 'recharge_request', 'wallet_address',
            'amount_crypto', 'exchange_rate', 'status', 'expires_at', 'created_at',
        ]


class InitiateCryptoSerializer(serializers.Serializer):
    currency  = serializers.ChoiceField(choices=CryptoPayment.CURRENCY_CHOICES)
    amount_dt = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('5'))


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = ['id', 'key', 'value', 'label']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hero-slide images are stored as relative keys; expose full URLs.
        if data.get('key') == 'HERO_SLIDES':
            data['value'] = hero.slides_to_urls(data.get('value', ''))
        return data

    def validate(self, attrs):
        # Persist hero-slide images as relative storage keys, never full URLs.
        key = attrs.get('key') or getattr(self.instance, 'key', None)
        if key == 'HERO_SLIDES' and 'value' in attrs:
            attrs['value'] = hero.slides_to_keys(attrs['value'])
        return attrs


class GiftCardSerializer(serializers.ModelSerializer):
    amount     = serializers.DecimalField(source='batch.amount', max_digits=10, decimal_places=2, read_only=True)
    expires_at = serializers.DateTimeField(source='batch.expires_at', read_only=True)
    is_used    = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model  = GiftCard
        fields = ['id', 'code', 'amount', 'expires_at', 'is_used', 'is_expired', 'created_at', 'redeemed_at']


class GiftCardBatchSerializer(serializers.ModelSerializer):
    cards_total     = serializers.IntegerField(source='quantity', read_only=True)
    cards_used      = serializers.SerializerMethodField()
    cards_available = serializers.SerializerMethodField()
    image           = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model  = GiftCardBatch
        fields = ['id', 'label', 'amount', 'quantity', 'expires_at', 'created_at',
                  'cards_total', 'cards_used', 'cards_available', 'image']

    def get_cards_used(self, obj):
        # Prefer a value annotated on the queryset (single grouped query);
        # fall back to a per-object count only when not annotated.
        val = getattr(obj, 'used_count', None)
        if val is not None:
            return val
        return obj.cards.filter(redeemed_by__isnull=False).count()

    def get_cards_available(self, obj):
        val = getattr(obj, 'available_count', None)
        if val is not None:
            return val
        return obj.cards.filter(redeemed_by__isnull=True).count()


class CreateGiftCardBatchSerializer(serializers.Serializer):
    label      = serializers.CharField(required=False, allow_blank=True)
    amount     = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('1'))
    quantity   = serializers.IntegerField(min_value=1, max_value=500)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

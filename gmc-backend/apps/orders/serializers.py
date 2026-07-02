from rest_framework import serializers
from .models import Order, PromoCode, OrderCredentials
from apps.products.serializers import ProductSerializer
from apps.products.models import Code


class PromoCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PromoCode
        fields = [
            'id', 'code', 'discount_type', 'discount_value',
            'max_uses', 'used_count', 'valid_until', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'used_count', 'created_at']


class OrderSerializer(serializers.ModelSerializer):
    product_detail     = ProductSerializer(source='product', read_only=True)
    code_value         = serializers.SerializerMethodField()
    bundle_name        = serializers.SerializerMethodField()
    product_name       = serializers.SerializerMethodField()
    user_username      = serializers.CharField(source='user.username', read_only=True)
    promo_code_str     = serializers.SerializerMethodField()
    has_credentials    = serializers.SerializerMethodField()
    conversation_id    = serializers.SerializerMethodField()
    variant_label      = serializers.SerializerMethodField()
    is_revealed        = serializers.SerializerMethodField()
    is_refund_eligible = serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = [
            'id', 'user', 'user_username',
            'product', 'product_detail', 'product_name',
            'bundle', 'bundle_name',
            'variant', 'variant_label',
            'amount_paid', 'service_fee', 'discount_amount', 'points_earned', 'points_used',
            'status', 'service_status', 'requires_account',
            'code_value', 'is_revealed', 'is_refund_eligible',
            'code_viewed_at', 'code_view_ip',
            'promo_code_str', 'has_credentials',
            'conversation_id', 'created_at',
        ]
        read_only_fields = [
            'id', 'amount_paid', 'service_fee', 'discount_amount', 'points_earned',
            'status', 'service_status', 'created_at',
        ]

    def _is_admin_request(self):
        request = self.context.get('request')
        return request and hasattr(request.user, 'role') and request.user.role == 'admin'

    def get_code_value(self, obj):
        if not obj.code:
            return None
        # Admins always see the code; clients only after reveal
        if self._is_admin_request() or obj.code_viewed_at is not None:
            return obj.code.code
        return None

    def get_is_revealed(self, obj):
        return obj.code_viewed_at is not None

    def get_is_refund_eligible(self, obj):
        return obj.is_refund_eligible

    def get_bundle_name(self, obj):
        return obj.bundle.name if obj.bundle else None

    def get_product_name(self, obj):
        if obj.product_id:
            return obj.product.name if obj.product else None
        if obj.bundle_id:
            return obj.bundle.name if obj.bundle else None
        return None

    def get_promo_code_str(self, obj):
        return obj.promo_code.code if obj.promo_code else None

    def get_has_credentials(self, obj):
        return hasattr(obj, 'credentials')

    def get_conversation_id(self, obj):
        try:
            return obj.user.conversation.id
        except Exception:
            return None

    def get_variant_label(self, obj):
        return obj.variant.label if obj.variant else None


class PlaceOrderSerializer(serializers.Serializer):
    product_id    = serializers.IntegerField(required=False)
    bundle_id     = serializers.IntegerField(required=False)
    variant_id    = serializers.IntegerField(required=False, allow_null=True)
    quantity      = serializers.IntegerField(default=1, min_value=1, max_value=20)
    points_to_use = serializers.IntegerField(default=0, min_value=0)
    promo_code    = serializers.CharField(required=False, allow_blank=True, default='')
    credentials   = serializers.DictField(required=False, allow_empty=True, default=dict)

    def validate_points_to_use(self, value):
        if value % 100 != 0:
            raise serializers.ValidationError('Points must be a multiple of 100.')
        return value

    def validate(self, data):
        if not data.get('product_id') and not data.get('bundle_id'):
            raise serializers.ValidationError('Provide either product_id or bundle_id.')
        return data


class OrderCredentialsSerializer(serializers.ModelSerializer):
    """Used by admin to view decrypted credentials."""
    data = serializers.SerializerMethodField()

    class Meta:
        model  = OrderCredentials
        fields = ['id', 'order', 'data', 'is_used', 'delivered_at', 'created_at', 'access_log']
        read_only_fields = fields

    def get_data(self, obj):
        try:
            return obj.get_data()
        except Exception:
            return None

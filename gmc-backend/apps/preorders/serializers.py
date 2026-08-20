from rest_framework import serializers

from .models import PreOrder


class PreOrderSerializer(serializers.ModelSerializer):
    """Client-facing view of one of their own pre-orders."""

    product_name       = serializers.CharField(source='product.name',  read_only=True)
    product_slug       = serializers.CharField(source='product.slug',  read_only=True)
    product_image      = serializers.ImageField(source='product.image', read_only=True)
    variant_label      = serializers.SerializerMethodField()
    preorder_note      = serializers.CharField(source='product.preorder_note', read_only=True)
    total_price        = serializers.DecimalField(source='total_at_order', max_digits=10, decimal_places=2, read_only=True)
    can_cancel         = serializers.BooleanField(read_only=True)
    cancel_seconds_left = serializers.IntegerField(read_only=True)
    order_id           = serializers.IntegerField(read_only=True)

    class Meta:
        model  = PreOrder
        fields = [
            'id', 'product', 'product_name', 'product_slug', 'product_image',
            'variant', 'variant_label', 'preorder_note',
            'price_at_order', 'service_fee_at_order', 'total_price',
            'status', 'queue_position', 'can_cancel', 'cancel_seconds_left',
            'failure_reason', 'order_id',
            'created_at', 'cancelled_at', 'fulfilled_at',
        ]

    def get_variant_label(self, obj):
        return obj.variant.label if obj.variant_id else None


class AdminPreOrderSerializer(PreOrderSerializer):
    """
    Admin view: adds who the client is and whether their wallet can cover the
    locked price right now, so the queue table answers "can I deliver to this
    person?" without a second lookup.
    """

    client_username = serializers.CharField(source='user.username', read_only=True)
    client_email    = serializers.CharField(source='user.email',    read_only=True)
    client_id       = serializers.IntegerField(source='user.id',    read_only=True)
    client_balance  = serializers.DecimalField(source='user.balance', max_digits=10, decimal_places=2, read_only=True)
    can_afford      = serializers.SerializerMethodField()
    shortfall       = serializers.SerializerMethodField()

    class Meta(PreOrderSerializer.Meta):
        fields = PreOrderSerializer.Meta.fields + [
            'client_id', 'client_username', 'client_email', 'client_balance',
            'can_afford', 'shortfall',
        ]

    def get_can_afford(self, obj):
        return obj.user.balance >= obj.total_at_order

    def get_shortfall(self, obj):
        diff = obj.total_at_order - obj.user.balance
        return str(diff) if diff > 0 else '0.00'


class PlacePreOrderSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)


class DeliverPreOrderSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=500)

    def validate_code(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Code cannot be empty.')
        return value

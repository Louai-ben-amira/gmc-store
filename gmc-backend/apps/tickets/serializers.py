from rest_framework import serializers
from .models import OrderTicket, OrderTicketMessage, SupportTicket, SupportTicketMessage


class _SenderMixin:
    def get_sender_username(self, obj):
        return obj.sender.username

    def get_sender_role(self, obj):
        return getattr(obj.sender, 'role', 'client')


class OrderTicketMessageSerializer(_SenderMixin, serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField()
    sender_role     = serializers.SerializerMethodField()

    class Meta:
        model  = OrderTicketMessage
        fields = ['id', 'ticket', 'sender', 'sender_username', 'sender_role',
                  'body', 'attachment', 'created_at', 'is_read']
        read_only_fields = ['id', 'ticket', 'sender', 'created_at', 'is_read']


class SupportTicketMessageSerializer(_SenderMixin, serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField()
    sender_role     = serializers.SerializerMethodField()

    class Meta:
        model  = SupportTicketMessage
        fields = ['id', 'ticket', 'sender', 'sender_username', 'sender_role',
                  'body', 'attachment', 'created_at', 'is_read']
        read_only_fields = ['id', 'ticket', 'sender', 'created_at', 'is_read']


class OrderTicketSerializer(serializers.ModelSerializer):
    user_username    = serializers.CharField(source='user.username', read_only=True)
    product_name     = serializers.SerializerMethodField()
    order_amount_paid = serializers.DecimalField(source='order.amount_paid', max_digits=10, decimal_places=2, read_only=True)
    last_message     = serializers.SerializerMethodField()

    class Meta:
        model  = OrderTicket
        fields = ['id', 'order', 'user', 'user_username', 'subject', 'status',
                  'product_name', 'order_amount_paid', 'last_message',
                  'created_at', 'updated_at', 'resolved_at']
        read_only_fields = ['id', 'user', 'status', 'created_at', 'updated_at', 'resolved_at']

    def get_product_name(self, obj):
        order = obj.order
        if order.product_id:
            return order.product.name if order.product else None
        if order.bundle_id:
            return order.bundle.name if order.bundle else None
        return None

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {'body': msg.body[:140], 'created_at': msg.created_at, 'sender_role': getattr(msg.sender, 'role', 'client')}


class OrderTicketDetailSerializer(OrderTicketSerializer):
    messages = OrderTicketMessageSerializer(many=True, read_only=True)

    class Meta(OrderTicketSerializer.Meta):
        fields = OrderTicketSerializer.Meta.fields + ['messages']


class SupportTicketSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = SupportTicket
        fields = ['id', 'user', 'user_username', 'category', 'subject', 'status',
                  'last_message', 'created_at', 'updated_at', 'resolved_at']
        read_only_fields = ['id', 'user', 'status', 'created_at', 'updated_at', 'resolved_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {'body': msg.body[:140], 'created_at': msg.created_at, 'sender_role': getattr(msg.sender, 'role', 'client')}


class SupportTicketDetailSerializer(SupportTicketSerializer):
    messages = SupportTicketMessageSerializer(many=True, read_only=True)

    class Meta(SupportTicketSerializer.Meta):
        fields = SupportTicketSerializer.Meta.fields + ['messages']


class CreateSupportTicketSerializer(serializers.ModelSerializer):
    description = serializers.CharField(write_only=True, min_length=20)

    class Meta:
        model  = SupportTicket
        fields = ['category', 'subject', 'description']

    def create(self, validated_data):
        description = validated_data.pop('description')
        user = self.context['request'].user
        ticket = SupportTicket.objects.create(user=user, **validated_data)
        attachment = self.context['request'].FILES.get('attachment')
        SupportTicketMessage.objects.create(
            ticket=ticket, sender=user, body=description, attachment=attachment,
        )
        return ticket

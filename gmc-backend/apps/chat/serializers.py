from rest_framework import serializers
from .models import Conversation, Message, CannedResponse
from apps.users.serializers import UserSerializer


class MessageSerializer(serializers.ModelSerializer):
    sender_detail = UserSerializer(source='sender', read_only=True)
    is_read       = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_detail', 'body',
            'attachment', 'msg_type', 'metadata',
            'status', 'delivered_at', 'read_at', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'sender', 'conversation', 'status', 'delivered_at', 'read_at', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    client_detail = UserSerializer(source='client', read_only=True)
    unread_count  = serializers.SerializerMethodField()
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = Conversation
        fields = ['id', 'client', 'client_detail', 'status', 'priority',
                  'last_message_at', 'unread_count', 'last_message', 'created_at']

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(
                status__in=['sent', 'delivered']
            ).exclude(sender=request.user).count()
        return 0

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            body = msg.body or '📎 Attachment'
            if msg.msg_type == 'order_card':
                body = '📋 Order details'
            elif msg.msg_type == 'credentials_card':
                body = '🔒 Credentials shared'
            elif msg.msg_type == 'status_update':
                body = msg.body or '🔄 Status update'
            return {'body': body, 'created_at': msg.created_at, 'msg_type': msg.msg_type}
        return None


class CannedResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CannedResponse
        fields = ['id', 'shortcut', 'body', 'used_count', 'created_at']
        read_only_fields = ['id', 'used_count', 'created_at']

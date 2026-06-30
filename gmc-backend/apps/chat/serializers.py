from rest_framework import serializers
from .models import Conversation, Message, CannedResponse
from apps.users.models import User


class UserMiniSerializer(serializers.ModelSerializer):
    """Lightweight user representation for embedding in chat payloads.

    Avoids the referral count/aggregate sub-queries that the full
    UserSerializer runs per object — those are pure N+1 when a user is
    embedded once per message/conversation.
    """
    class Meta:
        model  = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar', 'role']


class MessageSerializer(serializers.ModelSerializer):
    sender_detail = UserMiniSerializer(source='sender', read_only=True)
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
    client_detail = UserMiniSerializer(source='client', read_only=True)
    unread_count  = serializers.SerializerMethodField()
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = Conversation
        fields = ['id', 'client', 'client_detail', 'status', 'priority',
                  'last_message_at', 'unread_count', 'last_message', 'created_at']

    @staticmethod
    def _prefetched_messages(obj):
        """Return the prefetched message list if present, else None.

        When the queryset prefetched 'messages' (e.g. the admin list view),
        we compute unread/last from the cached rows instead of firing one
        query per conversation.
        """
        cache = getattr(obj, '_prefetched_objects_cache', None)
        if cache is not None and 'messages' in cache:
            return list(cache['messages'])
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not (request and request.user.is_authenticated):
            return 0
        msgs = self._prefetched_messages(obj)
        if msgs is not None:
            uid = request.user.id
            return sum(
                1 for m in msgs
                if m.status in ('sent', 'delivered') and m.sender_id != uid
            )
        return obj.messages.filter(
            status__in=['sent', 'delivered']
        ).exclude(sender=request.user).count()

    def get_last_message(self, obj):
        msgs = self._prefetched_messages(obj)
        # Message Meta orders by created_at asc, so the last item is newest.
        msg = (msgs[-1] if msgs else None) if msgs is not None else obj.messages.last()
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

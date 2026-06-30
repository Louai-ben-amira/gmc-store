from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import Conversation, Message, CannedResponse
from .serializers import ConversationSerializer, MessageSerializer, CannedResponseSerializer
from apps.users.permissions import IsAdmin


class ConversationView(generics.GenericAPIView):
    serializer_class   = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        conv, _ = Conversation.objects.get_or_create(client=request.user)
        return Response(ConversationSerializer(conv, context={'request': request}).data)


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class   = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = None  # chat needs all messages, not paginated pages

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            conv_id = self.request.query_params.get('conversation_id')
            if not conv_id:
                return Message.objects.none()
            return Message.objects.filter(conversation_id=conv_id).select_related('sender')
        conv, _ = Conversation.objects.get_or_create(client=user)
        return Message.objects.filter(conversation=conv).select_related('sender')

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        user = self.request.user
        if user.role == 'admin':
            conv_id = self.request.data.get('conversation_id')
            try:
                conv = Conversation.objects.get(pk=conv_id)
            except (Conversation.DoesNotExist, ValueError, TypeError):
                raise DRFValidationError({'detail': 'Invalid conversation.'})
        else:
            conv, _ = Conversation.objects.get_or_create(client=user)

        # Body length guard
        body = self.request.data.get('body', '')
        if len(body) > 2000:
            raise DRFValidationError({'body': 'Message too long (max 2000 characters).'})

        # Attachment file type guard
        attachment = self.request.FILES.get('attachment')
        if attachment:
            allowed = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
            if attachment.content_type not in allowed:
                raise DRFValidationError({'attachment': 'Only JPEG, PNG, GIF and WebP images are allowed.'})
            if attachment.size > 5 * 1024 * 1024:  # 5 MB
                raise DRFValidationError({'attachment': 'File too large (max 5 MB).'})

        conv.last_message_at = timezone.now()
        conv.save(update_fields=['last_message_at'])
        instance = serializer.save(sender=user, conversation=conv)

        # Broadcast the saved message to the conversation room so the
        # other party receives it in real-time without relying on WS send.
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'chat_{conv.id}',
                {
                    'type':           'chat_message',
                    'id':             instance.id,
                    'body':           instance.body,
                    'sender_id':      user.id,
                    'sender_name':    user.get_full_name() or user.username,
                    'attachment_url': instance.attachment.url if instance.attachment else None,
                    'msg_type':       instance.msg_type,
                    'metadata':       instance.metadata,
                    'created_at':     instance.created_at.isoformat(),
                    'status':         instance.status,
                }
            )
        except Exception:
            pass


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def mark_messages_read(request):
    user = request.user
    now  = timezone.now()
    if user.role == 'admin':
        conv_id = request.data.get('conversation_id')
        if conv_id:
            Message.objects.filter(
                conversation_id=conv_id, status__in=['sent', 'delivered']
            ).exclude(sender=user).update(status='read', read_at=now)
            Conversation.objects.filter(pk=conv_id).update(unread_count=0)
    else:
        conv, _ = Conversation.objects.get_or_create(client=user)
        Message.objects.filter(
            conversation=conv, status__in=['sent', 'delivered']
        ).exclude(sender=user).update(status='read', read_at=now)
        Conversation.objects.filter(pk=conv.id).update(unread_count=0)
    return Response({'detail': 'Marked as read.'})


# ── Canned Responses ──────────────────────────────────────────────────────────

class CannedResponseListCreateView(generics.ListCreateAPIView):
    serializer_class   = CannedResponseSerializer
    permission_classes = [IsAdmin]
    queryset           = CannedResponse.objects.all()


class CannedResponseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = CannedResponseSerializer
    permission_classes = [IsAdmin]
    queryset           = CannedResponse.objects.all()


@api_view(['POST'])
@permission_classes([IsAdmin])
def use_canned_response(request, pk):
    """Increment use_count when a canned response is inserted into a message."""
    try:
        cr = CannedResponse.objects.get(pk=pk)
    except CannedResponse.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    cr.used_count += 1
    cr.save()
    return Response(CannedResponseSerializer(cr).data)


# ── Order Context Panel ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdmin])
def user_context(request, user_id):
    from apps.users.models import User
    from apps.orders.models import Order
    from apps.orders.serializers import OrderSerializer
    from django.db.models import Sum, Count
    from django.utils.timesince import timesince

    try:
        client = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    completed = Order.objects.filter(user=client, status='completed')

    orders = completed.select_related('product', 'bundle').order_by('-created_at')[:5]

    stats = completed.aggregate(total=Sum('amount_paid'), count=Count('id'))
    total_spent = stats['total'] or 0
    order_count = stats['count']

    # Presence from cache
    presence = 'offline'
    last_seen_str = None
    try:
        from django.core.cache import cache
        presence = cache.get(f'presence:{client.id}', 'offline')
    except Exception:
        pass
    if client.last_seen:
        last_seen_str = timesince(client.last_seen) + ' ago'

    return Response({
        'id':          client.id,
        'username':    client.username,
        'email':       client.email,
        'balance':     str(client.balance),
        'points':      client.points,
        'total_spent': str(total_spent),
        'order_count': order_count,
        'joined':      timesince(client.created_at) + ' ago',
        'presence':    presence,
        'last_seen':   last_seen_str,
        'orders': [
            {
                'id':          o.id,
                'product':     o.product.name if o.product else (o.bundle.name if o.bundle else 'Unknown'),
                'amount_paid': str(o.amount_paid),
                'status':      o.status,
                'created_at':  o.created_at.isoformat(),
            }
            for o in orders
        ],
    })

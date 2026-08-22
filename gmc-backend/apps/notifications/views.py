from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.users.permissions import IsAdmin

from .models import Notification
from .serializers import BroadcastSerializer, MarkReadSerializer, NotificationSerializer
from .tasks import dispatch_broadcast

# How many notifications the bell dropdown shows.
FEED_LIMIT = 20


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_feed(request):
    """
    Everything the bell needs in one call: the newest notifications plus the
    unread badge count, so the client polls a single endpoint.
    """
    qs = Notification.objects.filter(user=request.user)
    notifications = qs[:FEED_LIMIT]
    return Response({
        'unread_count':  qs.filter(is_read=False).count(),
        'notifications': NotificationSerializer(
            notifications, many=True, context={'request': request},
        ).data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def unread_count(request):
    """Badge-only endpoint, kept for callers that don't need the full feed."""
    return Response({'count': Notification.objects.filter(user=request.user, is_read=False).count()})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_read(request):
    """Mark specific notifications read: {"ids": [...]} or {"all": true}."""
    serializer = MarkReadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    qs = Notification.objects.filter(user=request.user, is_read=False)
    if not serializer.validated_data.get('all'):
        qs = qs.filter(id__in=serializer.validated_data['ids'])

    updated = qs.update(is_read=True)
    return Response({'updated': updated})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_one_read(request, pk):
    """Legacy single-id endpoint, still used by older clients."""
    updated = Notification.objects.filter(pk=pk, user=request.user).update(is_read=True)
    if not updated:
        return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'detail': 'Marked as read.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_read(request):
    """Legacy mark-everything endpoint."""
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'detail': 'All marked as read.'})


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_notification(request, pk):
    deleted, _ = Notification.objects.filter(pk=pk, user=request.user).delete()
    if not deleted:
        return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


# -- Admin ------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAdmin])
def broadcast_audience(request):
    """How many people a broadcast would reach - shown in the compose modal."""
    User = get_user_model()
    return Response({'recipients': User.objects.filter(is_active=True).count()})


@api_view(['POST'])
@permission_classes([IsAdmin])
def broadcast(request):
    """Send one announcement to every active user's bell."""
    serializer = BroadcastSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    User = get_user_model()
    recipients = User.objects.filter(is_active=True).count()
    if not recipients:
        return Response({'detail': 'There are no active users to notify.'},
                        status=status.HTTP_400_BAD_REQUEST)

    transport = dispatch_broadcast(data['title'], data['body'], data.get('link') or '/')

    return Response({
        'recipients': recipients,
        'status':     'sending',
        'transport':  transport,
    }, status=status.HTTP_202_ACCEPTED)

import threading

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order
from apps.users.permissions import IsAdmin
from .models import OrderTicket, OrderTicketMessage, SupportTicket, SupportTicketMessage
from .serializers import (
    OrderTicketSerializer, OrderTicketDetailSerializer, OrderTicketMessageSerializer,
    SupportTicketSerializer, SupportTicketDetailSerializer, SupportTicketMessageSerializer,
    CreateSupportTicketSerializer,
)
from .tasks import send_order_ticket_reply_email, send_support_ticket_reply_email


def _fire(fn, *args, **kwargs):
    """Run a callable (e.g. Celery .delay()) in a daemon thread so it never blocks the response."""
    threading.Thread(target=lambda: fn(*args, **kwargs), daemon=True).start()


def _telegram_alert(message):
    try:
        from apps.payments.tasks import send_telegram_alert
        _fire(send_telegram_alert.delay, message)
    except Exception:
        pass


OPEN_STATUSES = ('open', 'in_progress')


# ── Order Tickets ──────────────────────────────────────────────────────────

class OrderTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return OrderTicketSerializer

    def get_queryset(self):
        return OrderTicket.objects.filter(user=self.request.user).select_related('order', 'order__product', 'order__bundle')

    def create(self, request, *args, **kwargs):
        order_id = request.data.get('order')
        if not order_id:
            return Response({'detail': 'order is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().select_related('product', 'bundle').get(pk=order_id, user=request.user)
            except Order.DoesNotExist:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

            existing = OrderTicket.objects.filter(order=order, status__in=OPEN_STATUSES).first()
            if existing:
                return Response(OrderTicketSerializer(existing).data, status=status.HTTP_200_OK)

            product_name = order.product.name if order.product else (order.bundle.name if order.bundle else 'Unknown')
            subject = request.data.get('subject') or f'Order #{order.id} — {product_name}'
            description = request.data.get('description', '').strip()

            ticket = OrderTicket.objects.create(order=order, user=request.user, subject=subject)
            if description:
                OrderTicketMessage.objects.create(ticket=ticket, sender=request.user, body=description)

        _telegram_alert(f"📦 New order ticket #{ticket.id} on Order #{order.id}\n{request.user.username}\n{subject}")
        return Response(OrderTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class OrderTicketDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderTicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = OrderTicket.objects.select_related('order', 'order__product', 'order__bundle').prefetch_related('messages__sender')
        if user.role == 'admin':
            return qs
        return qs.filter(user=user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def order_ticket_send_message(request, pk):
    user = request.user
    try:
        if user.role == 'admin':
            ticket = OrderTicket.objects.get(pk=pk)
        else:
            ticket = OrderTicket.objects.get(pk=pk, user=user)
    except OrderTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    if ticket.status in ('resolved', 'closed'):
        return Response({'detail': 'This ticket is closed and no longer accepts messages.'}, status=status.HTTP_400_BAD_REQUEST)

    body = request.data.get('body', '').strip()
    attachment = request.FILES.get('attachment')
    if not body and not attachment:
        return Response({'detail': 'Message body or attachment is required.'}, status=status.HTTP_400_BAD_REQUEST)

    msg = OrderTicketMessage.objects.create(ticket=ticket, sender=user, body=body, attachment=attachment)
    ticket.save()  # bump updated_at via auto_now

    if user.role == 'admin':
        _fire(send_order_ticket_reply_email.delay, ticket.id)
        from apps.notifications.services import notify
        notify(
            ticket.user, 'ticket_reply', 'Ticket Reply',
            f'GMC Store replied to your ticket #{ticket.id} — Order #{ticket.order_id}',
            link=f'/support/order/{ticket.id}',
        )
    else:
        _telegram_alert(f"📦 New reply on order ticket #{ticket.id}\n{user.username}")

    return Response(OrderTicketMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAdmin])
def order_ticket_set_status(request, pk):
    try:
        ticket = OrderTicket.objects.get(pk=pk)
    except OrderTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    if new_status not in ('open', 'in_progress', 'resolved', 'closed'):
        return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    ticket.status = new_status
    if new_status == 'resolved':
        ticket.resolved_at = timezone.now()
    ticket.save()
    return Response(OrderTicketSerializer(ticket).data)


@api_view(['DELETE'])
@permission_classes([IsAdmin])
def order_ticket_delete(request, pk):
    try:
        ticket = OrderTicket.objects.get(pk=pk)
    except OrderTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)
    ticket.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_order_tickets(request):
    qs = OrderTicket.objects.select_related('order', 'order__product', 'order__bundle', 'user').prefetch_related('messages')
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(OrderTicketSerializer(qs, many=True).data)


# ── Support Tickets ────────────────────────────────────────────────────────

class SupportTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateSupportTicketSerializer
        return SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = CreateSupportTicketSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        _telegram_alert(f"🛠️ New support ticket #{ticket.id} ({ticket.get_category_display()})\n{request.user.username}\n{ticket.subject}")
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class SupportTicketDetailView(generics.RetrieveAPIView):
    serializer_class   = SupportTicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = SupportTicket.objects.prefetch_related('messages__sender')
        if user.role == 'admin':
            return qs
        return qs.filter(user=user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def support_ticket_send_message(request, pk):
    user = request.user
    try:
        if user.role == 'admin':
            ticket = SupportTicket.objects.get(pk=pk)
        else:
            ticket = SupportTicket.objects.get(pk=pk, user=user)
    except SupportTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    if ticket.status in ('resolved', 'closed'):
        return Response({'detail': 'This ticket is closed and no longer accepts messages.'}, status=status.HTTP_400_BAD_REQUEST)

    body = request.data.get('body', '').strip()
    attachment = request.FILES.get('attachment')
    if not body and not attachment:
        return Response({'detail': 'Message body or attachment is required.'}, status=status.HTTP_400_BAD_REQUEST)

    msg = SupportTicketMessage.objects.create(ticket=ticket, sender=user, body=body, attachment=attachment)
    ticket.save()

    if user.role == 'admin':
        _fire(send_support_ticket_reply_email.delay, ticket.id)
        from apps.notifications.services import notify
        notify(
            ticket.user, 'ticket_reply', 'Ticket Reply',
            f'GMC Store replied to your ticket #{ticket.id} — {ticket.subject}',
            link=f'/support/general/{ticket.id}',
        )
    else:
        _telegram_alert(f"🛠️ New reply on support ticket #{ticket.id}\n{user.username}")

    return Response(SupportTicketMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAdmin])
def support_ticket_set_status(request, pk):
    try:
        ticket = SupportTicket.objects.get(pk=pk)
    except SupportTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    if new_status not in ('open', 'in_progress', 'resolved', 'closed'):
        return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    ticket.status = new_status
    if new_status == 'resolved':
        ticket.resolved_at = timezone.now()
    ticket.save()
    return Response(SupportTicketSerializer(ticket).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_create_ticket(request):
    """Admin proactively opens a ticket to contact a client.

    Body: user_id, subject, body (first message), optional category,
    optional order_id (creates an OrderTicket on that order instead).
    """
    from django.contrib.auth import get_user_model
    from apps.notifications.services import notify

    subject = (request.data.get('subject') or '').strip()
    body    = (request.data.get('body') or '').strip()
    if not subject or not body:
        return Response({'detail': 'subject and body are required.'}, status=status.HTTP_400_BAD_REQUEST)

    order_id = request.data.get('order_id')
    if order_id:
        try:
            order = Order.objects.select_related('user').get(pk=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            ticket = OrderTicket.objects.filter(order=order, status__in=OPEN_STATUSES).first()
            if not ticket:
                ticket = OrderTicket.objects.create(order=order, user=order.user, subject=subject)
            OrderTicketMessage.objects.create(ticket=ticket, sender=request.user, body=body)
            ticket.save()  # bump updated_at

        _fire(send_order_ticket_reply_email.delay, ticket.id)
        notify(
            ticket.user, 'ticket_reply', 'Message from GMC Store',
            f'GMC Store opened a ticket about your Order #{order.id} — {subject}',
            link=f'/support/order/{ticket.id}',
        )
        return Response(OrderTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        client = get_user_model().objects.get(pk=user_id)
    except get_user_model().DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    category = request.data.get('category') or 'other'
    if category not in dict(SupportTicket.CATEGORY_CHOICES):
        category = 'other'

    with transaction.atomic():
        ticket = SupportTicket.objects.create(user=client, category=category, subject=subject)
        SupportTicketMessage.objects.create(ticket=ticket, sender=request.user, body=body)

    _fire(send_support_ticket_reply_email.delay, ticket.id)
    notify(
        client, 'ticket_reply', 'Message from GMC Store',
        f'GMC Store opened a ticket for you — {subject}',
        link=f'/support/general/{ticket.id}',
    )
    return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAdmin])
def support_ticket_delete(request, pk):
    try:
        ticket = SupportTicket.objects.get(pk=pk)
    except SupportTicket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)
    ticket.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_support_tickets(request):
    qs = SupportTicket.objects.select_related('user').prefetch_related('messages')
    status_filter   = request.query_params.get('status')
    category_filter = request.query_params.get('category')
    if status_filter:
        qs = qs.filter(status=status_filter)
    if category_filter:
        qs = qs.filter(category=category_filter)
    return Response(SupportTicketSerializer(qs, many=True).data)

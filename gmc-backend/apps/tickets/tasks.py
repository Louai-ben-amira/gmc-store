from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_order_ticket_reply_email(ticket_id):
    from apps.tickets.models import OrderTicket
    try:
        ticket = OrderTicket.objects.select_related('user', 'order').get(pk=ticket_id)
        if not ticket.user.email:
            return
        subject = f'GMC Store: Admin replied to your ticket #{ticket.id}'
        message = (
            f'Hi {ticket.user.get_full_name() or ticket.user.username},\n\n'
            f'An admin replied to your order ticket regarding Order #{ticket.order_id}.\n'
            f'Subject: {ticket.subject}\n\n'
            f'View it here: {getattr(settings, "FRONTEND_URL", "http://localhost:5173")}/support/order/{ticket.id}\n\n'
            f'Thank you for using GMC Store!'
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [ticket.user.email], fail_silently=True)
    except Exception:
        pass


@shared_task
def send_support_ticket_reply_email(ticket_id):
    from apps.tickets.models import SupportTicket
    try:
        ticket = SupportTicket.objects.select_related('user').get(pk=ticket_id)
        if not ticket.user.email:
            return
        subject = f'GMC Store: Admin replied to your ticket #{ticket.id}'
        message = (
            f'Hi {ticket.user.get_full_name() or ticket.user.username},\n\n'
            f'An admin replied to your support ticket.\n'
            f'Subject: {ticket.subject}\n\n'
            f'View it here: {getattr(settings, "FRONTEND_URL", "http://localhost:5173")}/support/general/{ticket.id}\n\n'
            f'Thank you for using GMC Store!'
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [ticket.user.email], fail_silently=True)
    except Exception:
        pass

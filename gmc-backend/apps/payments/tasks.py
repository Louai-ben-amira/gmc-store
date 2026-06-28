from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_recharge_approved_email(recharge_id):
    from apps.payments.models import RechargeRequest
    try:
        recharge = RechargeRequest.objects.select_related('user').get(pk=recharge_id)
        subject = 'Recharge Approved - GMC Store'
        message = (
            f'Hi {recharge.user.get_full_name() or recharge.user.username},\n\n'
            f'Your recharge of {recharge.amount} DT has been approved!\n'
            f'Your wallet balance has been updated.\n\n'
            f'Thank you for using GMC Store!'
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [recharge.user.email], fail_silently=True)
    except Exception:
        pass


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_telegram_alert(self, message: str):
    """Send a message to the admin Telegram chat. Retries up to 3× on failure."""
    import requests
    token   = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    chat_id = getattr(settings, 'TELEGRAM_CHAT_ID', '')
    if not token or not chat_id:
        return 'Telegram not configured'
    try:
        resp = requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={'chat_id': chat_id, 'text': message, 'parse_mode': 'HTML'},
            timeout=10,
        )
        resp.raise_for_status()
        return 'sent'
    except Exception as exc:
        raise self.retry(exc=exc)

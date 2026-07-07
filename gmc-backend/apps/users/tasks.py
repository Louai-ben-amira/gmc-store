from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_password_reset_email(user_id, uid, token):
    from .models import User
    try:
        user = User.objects.get(pk=user_id)
        reset_link = f'{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}'
        subject = 'Reset your password - GMC Store'
        message = (
            f'Hi {user.get_full_name() or user.username},\n\n'
            f'We received a request to reset your GMC Store password.\n'
            f'Click the link below to choose a new one (valid for 24 hours):\n\n'
            f'{reset_link}\n\n'
            f"If you didn't request this, you can safely ignore this email.\n\n"
            f'Thank you for using GMC Store!'
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
    except User.DoesNotExist:
        pass

import logging

from celery import shared_task
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings

logger = logging.getLogger(__name__)


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


@shared_task
def send_verification_email(user_id, email, name, code):
    """Send the 6-digit verification code to a newly registered account."""
    subject = f'{code} is your GMC Store verification code'

    html_body = f"""
    <div style="font-family:Outfit,sans-serif;max-width:480px;margin:0 auto;
                background:#0D0018;color:#fff;padding:32px;border-radius:12px">
      <h2 style="color:#B57BFF">GMC Store</h2>
      <p>Hi {name},</p>
      <p>Enter this code to verify your email address and activate your account:</p>
      <div style="margin:24px 0;padding:18px 0;text-align:center;
                  background:rgba(155,79,237,0.12);border:1px solid rgba(155,79,237,0.35);
                  border-radius:10px;font-size:32px;font-weight:700;letter-spacing:8px;
                  color:#fff;font-family:'JetBrains Mono',monospace">
        {code}
      </div>
      <p style="color:#8866AA;font-size:13px">
        This code expires in 15 minutes.<br>
        If you didn't create a GMC Store account, ignore this email.
      </p>
    </div>
    """

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=f'Your GMC Store verification code is: {code} (expires in 15 minutes)',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send()
    except Exception as e:
        logger.error(f'Verify email failed for user {user_id}: {e}')

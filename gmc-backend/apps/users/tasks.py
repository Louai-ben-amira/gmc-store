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
def send_verification_email(user_id, email, name, token):
    """Send the "verify your email" link to a newly registered account."""
    verify_url = f'{settings.FRONTEND_URL}/verify-email?token={token}'
    subject = 'Verify your GMC Store account'

    html_body = f"""
    <div style="font-family:Outfit,sans-serif;max-width:480px;margin:0 auto;
                background:#0D0018;color:#fff;padding:32px;border-radius:12px">
      <h2 style="color:#B57BFF">GMC Store</h2>
      <p>Hi {name},</p>
      <p>Click the button below to verify your email address and activate your account:</p>
      <a href="{verify_url}"
         style="display:inline-block;margin:20px 0;padding:12px 28px;
                background:linear-gradient(135deg,#6D28D9,#9B4FED);
                color:white;border-radius:10px;text-decoration:none;font-weight:700">
        Verify My Email
      </a>
      <p style="color:#8866AA;font-size:13px">
        This link expires in 24 hours.<br>
        If you didn't create a GMC Store account, ignore this email.
      </p>
      <p style="color:#8866AA;font-size:11px">
        Or copy this link:<br>
        <span style="color:#B57BFF">{verify_url}</span>
      </p>
    </div>
    """

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=f'Verify your account: {verify_url}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send()
    except Exception as e:
        logger.error(f'Verify email failed for user {user_id}: {e}')

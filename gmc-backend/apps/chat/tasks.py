"""Unread-message email alerts.

When an admin replies in the messenger and the client is offline (closed the
app), they have no way to know. Five minutes after each admin message we check:
if it is still unread and the client is not connected to the chat, we email
them a "you have a new message" alert.

NOTE: Celery runs in ALWAYS_EAGER mode in this deployment (no worker process),
so a countdown task would fire immediately. We use a daemon threading.Timer
instead - the same pattern used for Telegram alerts elsewhere in the codebase.
Pending timers are lost on process restart, which is an acceptable trade-off.
"""
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

# How long to wait before checking whether the message was read
UNREAD_CHECK_DELAY_SECONDS = 5 * 60
# At most one alert email per conversation per this window
EMAIL_COOLDOWN = timedelta(hours=1)


def _unread_email(client, message):
    name         = client.get_full_name() or client.username
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    chat_url     = f'{frontend_url}/messenger'

    snippet = escape((message.body or 'You received an attachment.')[:120])

    subject = '💬 New message from GMC Store support'

    html = f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Message - GMC Store</title></head>
<body style="margin:0;padding:0;background:#08081a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08081a;padding:48px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#12122a;border-radius:20px;overflow:hidden;border:1px solid rgba(123,47,255,0.35);">

        <tr><td style="background:linear-gradient(135deg,#18083a 0%,#2e1168 100%);padding:44px 36px 36px;text-align:center;border-bottom:1px solid rgba(123,47,255,0.4);">
          <div style="width:72px;height:72px;background:rgba(123,47,255,0.15);border:2px solid rgba(123,47,255,0.5);border-radius:50%;display:inline-block;line-height:72px;font-size:36px;margin-bottom:20px;">💬</div>
          <h1 style="color:#ffffff;margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-0.5px;">You have a new message</h1>
          <p style="color:#c4b5fd;margin:0;font-size:15px;">Hi <strong style="color:#ffffff;">{name}</strong>, our support team replied to you.</p>
        </td></tr>

        <tr><td style="padding:28px 36px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1c3e;border:1px solid rgba(123,47,255,0.3);border-radius:14px;">
            <tr><td style="padding:18px 22px;">
              <p style="color:#94a3b8;margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">GMC Store Support</p>
              <p style="color:#ffffff;margin:0;font-size:15px;line-height:1.6;">{snippet}{'…' if len(message.body or '') > 120 else ''}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 36px 36px;text-align:center;">
          <a href="{chat_url}" style="display:inline-block;background:linear-gradient(135deg,#7b2fff 0%,#5b0fd4 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 42px;border-radius:12px;letter-spacing:0.02em;box-shadow:0 4px 24px rgba(123,47,255,0.4);">
            Open Chat →
          </a>
        </td></tr>

        <tr><td style="padding:24px 36px;background:#0c0c22;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="color:#3d3d5c;font-size:12px;margin:0 0 6px;line-height:1.6;">You received this because you have an unread message at <strong style="color:#5a5a7a;">GMC Store</strong>.</p>
          <p style="color:#3d3d5c;font-size:12px;margin:0;">© 2025 GMC Store - All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'''

    plain = (
        f'Hi {name},\n\n'
        f'GMC Store support sent you a new message:\n\n'
        f'"{snippet}"\n\n'
        f'Open the chat to read and reply: {chat_url}\n'
    )

    return subject, plain, html


def _check_and_send_unread_email(message_id):
    """Runs in a daemon thread ~5 minutes after an admin message is sent."""
    from django.db import connection
    try:
        from apps.chat.models import Message, Conversation

        try:
            message = Message.objects.select_related('conversation__client').get(pk=message_id)
        except Message.DoesNotExist:
            return

        # Already read in-app - nothing to do
        if message.status == 'read':
            return

        conv   = message.conversation
        client = conv.client

        if not client.email:
            return

        # Client is actively connected to the chat - they will see it
        try:
            from django.core.cache import cache
            if cache.get(f'presence:{client.id}') == 'online':
                return
        except Exception:
            pass

        # Cooldown: max one alert email per conversation per hour
        now = timezone.now()
        if conv.last_email_alert_at and now - conv.last_email_alert_at < EMAIL_COOLDOWN:
            return

        subject, plain, html = _unread_email(client, message)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[client.email],
        )
        msg.attach_alternative(html, 'text/html')
        msg.send()

        Conversation.objects.filter(pk=conv.pk).update(last_email_alert_at=now)
    except Exception:
        pass
    finally:
        # This thread opened its own DB connection - release it
        try:
            connection.close()
        except Exception:
            pass


def schedule_unread_email_check(message_id):
    """Call right after an admin message is saved. Fires the check in ~5 min."""
    timer = threading.Timer(UNREAD_CHECK_DELAY_SECONDS, _check_and_send_unread_email, args=[message_id])
    timer.daemon = True
    timer.start()

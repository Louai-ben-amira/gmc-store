"""Unread-message email alerts.

When an admin replies in the messenger and the client is offline (closed the
app), they have no way to know. If an admin message stays unread for ~5
minutes and the client is not connected to the chat, we email them a "you
have a new message" alert.

HOW IT RUNS: production uses gunicorn with --max-requests, so worker processes
restart frequently - in-memory timers do not survive. Instead, a sweep runs
opportunistically on incoming requests (see middleware.py), at most once per
SWEEP_INTERVAL, guarded by an atomic cache lock. All state lives in the DB
(Message.status + Conversation.last_email_alert_at), so restarts lose nothing.

Celery is configured ALWAYS_EAGER (no worker process), so this deliberately
avoids Celery countdown tasks.
"""
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape

# A message must stay unread this long before we email about it
UNREAD_AGE = timedelta(minutes=5)
# At most one alert email per conversation per this window
EMAIL_COOLDOWN = timedelta(hours=1)
# Don't email about messages older than this (e.g. pre-feature backlog)
MAX_AGE = timedelta(days=2)
# Sweep at most once per this many seconds across all workers
SWEEP_INTERVAL = 60

_SWEEP_LOCK_KEY = 'chat:unread_email_sweep_lock'


def _unread_email(client, message):
    name         = client.get_full_name() or client.username
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    chat_url     = f'{frontend_url}/messenger'

    body    = message.body or 'You received an attachment.'
    snippet = escape(body[:120])

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
              <p style="color:#ffffff;margin:0;font-size:15px;line-height:1.6;">{snippet}{'…' if len(body) > 120 else ''}</p>
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
        f'"{body[:120]}"\n\n'
        f'Open the chat to read and reply: {chat_url}\n'
    )

    return subject, plain, html


def _claim_conversation(conv_id, now):
    """Atomically claim the right to email this conversation (cooldown guard).

    Returns True for exactly one caller even if the timer path and the sweep
    race each other - the UPDATE only matches while the cooldown has lapsed.
    """
    from apps.chat.models import Conversation
    return Conversation.objects.filter(pk=conv_id).filter(
        Q(last_email_alert_at__isnull=True) |
        Q(last_email_alert_at__lt=now - EMAIL_COOLDOWN)
    ).update(last_email_alert_at=now) == 1


def _client_is_online(client_id):
    try:
        from django.core.cache import cache
        return cache.get(f'presence:{client_id}') == 'online'
    except Exception:
        return False


def _send_alert(conv, message, now):
    """Presence + cooldown checks, then send. Assumes message is unread."""
    client = conv.client
    if not client.email:
        return
    if _client_is_online(client.id):
        return
    if not _claim_conversation(conv.pk, now):
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


def sweep_unread_alerts():
    """Email clients whose admin messages have been unread for UNREAD_AGE+.

    Only messages newer than the conversation's last alert are considered, so
    each batch of unread messages produces at most one email ever.
    """
    from apps.chat.models import Message

    now    = timezone.now()
    cutoff = now - UNREAD_AGE

    candidates = (
        Message.objects
        .filter(
            sender__role='admin',
            status__in=['sent', 'delivered'],
            created_at__lte=cutoff,
            created_at__gte=now - MAX_AGE,
        )
        .select_related('conversation__client')
        .order_by('conversation_id', '-created_at')
    )

    # One email max per conversation per sweep; newest unread message wins
    seen_convs = set()
    for message in candidates:
        conv = message.conversation
        if conv.pk in seen_convs:
            continue
        seen_convs.add(conv.pk)

        # Only alert about messages the client hasn't already been emailed for
        if conv.last_email_alert_at and message.created_at <= conv.last_email_alert_at:
            continue

        try:
            _send_alert(conv, message, now)
        except Exception:
            pass


def start_sweep_if_due():
    """Called from middleware on incoming requests. Runs the sweep in a
    background thread at most once per SWEEP_INTERVAL across all workers
    (atomic cache.add lock on Redis)."""
    try:
        from django.core.cache import cache
        if not cache.add(_SWEEP_LOCK_KEY, 1, timeout=SWEEP_INTERVAL):
            return
    except Exception:
        return

    def _run():
        from django.db import connection
        try:
            sweep_unread_alerts()
        except Exception:
            pass
        finally:
            try:
                connection.close()
            except Exception:
                pass

    threading.Thread(target=_run, daemon=True).start()

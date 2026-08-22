"""
Pre-order emails and the hourly "your free-cancellation window is closing"
reminder. Everything here is best-effort: a mail failure must never break the
pre-order it belongs to.
"""
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def _frontend(path=''):
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    return f'{base}{path}'


def _label(preorder):
    name = preorder.product.name
    return f'{name} ({preorder.variant.label})' if preorder.variant_id else name


def _shell(*, badge, badge_color, heading, intro, rows, note, note_color, cta_label, cta_url):
    """The shared GMC-branded email body - same visual language as order emails."""
    row_html = ''.join(
        f'''
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:14px;">{label}</td>
          <td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#ffffff;font-size:14px;font-weight:600;text-align:right;">{value}</td>
        </tr>'''
        for label, value in rows
    )
    return f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{heading} - GMC Store</title></head>
<body style="margin:0;padding:0;background:#08081a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08081a;padding:48px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#12122a;border-radius:20px;overflow:hidden;border:1px solid rgba(123,47,255,0.35);">

        <tr><td style="background:linear-gradient(135deg,#18083a 0%,#2e1168 100%);padding:44px 36px 36px;text-align:center;border-bottom:1px solid rgba(123,47,255,0.4);">
          <div style="width:72px;height:72px;background:{badge_color}22;border:2px solid {badge_color}73;border-radius:50%;display:inline-block;line-height:72px;font-size:34px;margin-bottom:20px;">{badge}</div>
          <h1 style="color:#ffffff;margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-0.5px;">{heading}</h1>
          <p style="color:#c4b5fd;margin:0;font-size:15px;line-height:1.6;">{intro}</p>
        </td></tr>

        <tr><td style="padding:22px 36px 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1c3e;border:1px solid rgba(123,47,255,0.3);border-radius:14px;">
            <tr><td style="padding:8px 22px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0">{row_html}</table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 36px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:{note_color}14;border:1px solid {note_color}3d;border-radius:10px;">
            <tr><td style="padding:14px 18px;">
              <p style="color:{note_color};margin:0;font-size:13px;line-height:1.7;">{note}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 36px 36px;text-align:center;">
          <a href="{cta_url}" style="display:inline-block;background:linear-gradient(135deg,#7b2fff 0%,#5b0fd4 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 42px;border-radius:12px;box-shadow:0 4px 24px rgba(123,47,255,0.4);">{cta_label}</a>
        </td></tr>

        <tr><td style="padding:24px 36px;background:#0c0c22;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="color:#3d3d5c;font-size:12px;margin:0;">&copy; 2025 GMC Store - All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'''


def _send(preorder, subject, plain, html):
    if not preorder.user.email:
        return
    msg = EmailMultiAlternatives(
        subject=subject,
        body=plain,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[preorder.user.email],
    )
    msg.attach_alternative(html, 'text/html')
    msg.send()


def _load(preorder_id):
    from .models import PreOrder
    return PreOrder.objects.select_related('user', 'product', 'variant').get(pk=preorder_id)


# -- Emails -----------------------------------------------------------------

@shared_task
def send_preorder_placed_email(preorder_id):
    try:
        po   = _load(preorder_id)
        name = po.user.get_full_name() or po.user.username
        item = _label(po)
        total = f'{float(po.total_at_order):.2f} DT'

        html = _shell(
            badge='&#128203;', badge_color='#f59e0b',
            heading='Pre-order placed!',
            intro=f'Hi <strong style="color:#ffffff;">{name}</strong>, '
                  f"you're #{po.queue_position} in the queue.",
            rows=[
                ('Product',        item),
                ('Queue position', f'#{po.queue_position}'),
                ('Price locked',   f'{float(po.price_at_order):.2f} DT'),
                ('Service fee',    f'{float(po.service_fee_at_order):.2f} DT'),
                ('Charged later',  total),
            ],
            note='<b>No payment has been taken.</b> You will be charged '
                 f'{total} only when your code is ready — so keep enough balance '
                 'in your wallet. Free cancellation within 24 hours.',
            note_color='#f59e0b',
            cta_label='View My Pre-orders',
            cta_url=_frontend('/preorders'),
        )
        plain = (
            f'Hi {name},\n\n'
            f'Your pre-order for {item} is confirmed.\n'
            f'Queue position: #{po.queue_position}\n'
            f'Price locked: {total}\n\n'
            f'No payment has been taken yet — you will be charged {total} when your '
            f'code is ready. Free cancellation within 24 hours.\n\n'
            f'{_frontend("/preorders")}\n'
        )
        _send(po, f'Pre-order confirmed - {item}', plain, html)
    except Exception:
        pass


@shared_task
def send_preorder_reminder_email(preorder_id):
    try:
        po   = _load(preorder_id)
        name = po.user.get_full_name() or po.user.username
        item = _label(po)

        html = _shell(
            badge='&#9200;', badge_color='#f59e0b',
            heading='1 hour left to cancel for free',
            intro=f'Hi <strong style="color:#ffffff;">{name}</strong>, your free-cancellation '
                  f'window is about to close.',
            rows=[
                ('Product',        item),
                ('Queue position', f'#{po.queue_position}'),
                ('Charged later',  f'{float(po.total_at_order):.2f} DT'),
            ],
            note='After this window closes your pre-order is locked in — you would '
                 'need to open a support ticket to cancel it. Nothing to do if you '
                 'still want the product; just keep enough balance in your wallet.',
            note_color='#f59e0b',
            cta_label='Manage My Pre-orders',
            cta_url=_frontend('/preorders'),
        )
        plain = (
            f'Hi {name},\n\n'
            f'You have about 1 hour left to cancel your pre-order for {item} for free.\n'
            f'After that you would need to contact support to cancel.\n\n'
            f'{_frontend("/preorders")}\n'
        )
        _send(po, f'1 hour left to cancel your pre-order - {item}', plain, html)
    except Exception:
        pass


@shared_task
def send_preorder_failed_email(preorder_id):
    try:
        po   = _load(preorder_id)
        name = po.user.get_full_name() or po.user.username
        item = _label(po)

        html = _shell(
            badge='&#9888;', badge_color='#ff6b85',
            heading="Pre-order couldn't be fulfilled",
            intro=f'Hi <strong style="color:#ffffff;">{name}</strong>, your wallet was short '
                  f'when your code came up.',
            rows=[
                ('Product',       item),
                ('Amount needed', f'{float(po.total_at_order):.2f} DT'),
                ('Your balance',  f'{float(po.user.balance):.2f} DT'),
            ],
            note='<b>You were not charged.</b> Top up your wallet and contact support '
                 'to get back in the queue for this product.',
            note_color='#ff6b85',
            cta_label='Top Up My Wallet',
            cta_url=_frontend('/wallet'),
        )
        plain = (
            f'Hi {name},\n\n'
            f'Your pre-order for {item} could not be fulfilled — it needs '
            f'{float(po.total_at_order):.2f} DT but your wallet has '
            f'{float(po.user.balance):.2f} DT.\n\n'
            f'You were not charged. Please top up and contact support.\n\n'
            f'{_frontend("/wallet")}\n'
        )
        _send(po, f'Pre-order not fulfilled - {item}', plain, html)
    except Exception:
        pass


# -- Beat -------------------------------------------------------------------

@shared_task
def send_preorder_cancel_reminders():
    """
    Hourly: warn clients whose 24h free-cancellation window closes within the
    next hour. cancel_reminder_sent makes this idempotent, so a re-run (or a
    missed hour) never double-sends.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.notifications.services import notify_event
    from .models import CANCEL_WINDOW_HOURS, PreOrder

    now      = timezone.now()
    # Window closes at created_at + 24h; we want the ones closing in <= 1h.
    deadline = now + timedelta(hours=1)
    due = PreOrder.objects.select_related('user', 'product', 'variant').filter(
        status='pending',
        cancel_reminder_sent=False,
        created_at__lte=deadline - timedelta(hours=CANCEL_WINDOW_HOURS),
        created_at__gt=now - timedelta(hours=CANCEL_WINDOW_HOURS),
    )

    sent = 0
    for po in due:
        try:
            notify_event(
                po.user, 'preorder_reminder', link='/preorders', product=_label(po),
            )
            send_preorder_reminder_email(po.id)
            po.cancel_reminder_sent = True
            po.save(update_fields=['cancel_reminder_sent'])
            sent += 1
        except Exception:
            continue

    return f'Sent {sent} pre-order cancellation reminder(s)'

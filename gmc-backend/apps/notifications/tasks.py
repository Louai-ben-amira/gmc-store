"""
Broadcast delivery.

Deployment note: this project runs with CELERY_TASK_ALWAYS_EAGER=True and no
separate worker (see render.yaml), so `.delay()` executes inline inside the
web request. `dispatch_broadcast` therefore hands the work to a daemon thread
in that mode, keeping the admin's HTTP response instant, and uses a real
Celery worker whenever one is actually configured.
"""
import logging
import threading

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)

# Rows per bulk_create round-trip.
BATCH = 500


@shared_task
def broadcast_notification(title, body, link='/'):
    """Drop one announcement into every active user's bell."""
    from django.contrib.auth import get_user_model
    from .models import Notification

    User = get_user_model()
    user_ids = list(User.objects.filter(is_active=True).values_list('id', flat=True))

    created = 0
    for i in range(0, len(user_ids), BATCH):
        chunk = user_ids[i:i + BATCH]
        try:
            Notification.objects.bulk_create([
                Notification(
                    user_id=uid, type='announcement',
                    title=title, body=body, link=link or '/',
                )
                for uid in chunk
            ])
            created += len(chunk)
        except Exception:
            # One bad batch must not cost the rest of the audience.
            logger.exception('Broadcast batch %s-%s failed', i, i + len(chunk))

    logger.info('Broadcast delivered to %s/%s users', created, len(user_ids))
    return created


def dispatch_broadcast(title, body, link='/'):
    """
    Kick the broadcast off without making the admin wait for it.

    With a real Celery worker this is a normal .delay(). In this project's
    eager setup .delay() would run synchronously and hold the request open
    for the whole audience, so the work goes to a background thread instead.
    """
    eager = getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False)
    if eager:
        threading.Thread(
            target=lambda: _run_safely(title, body, link),
            daemon=True,
        ).start()
        return 'thread'
    try:
        broadcast_notification.delay(title, body, link)
        return 'celery'
    except Exception:
        # Broker unreachable - fall back rather than losing the broadcast.
        threading.Thread(target=lambda: _run_safely(title, body, link), daemon=True).start()
        return 'thread'


def _run_safely(title, body, link):
    from django.db import connection
    try:
        broadcast_notification(title, body, link)
    except Exception:
        logger.exception('Broadcast thread failed')
    finally:
        # A thread that opened its own DB connection must hand it back, or
        # the pool leaks one connection per broadcast.
        connection.close()

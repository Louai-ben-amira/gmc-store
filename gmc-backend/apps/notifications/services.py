"""
Thin helper other apps call to create in-app notifications. Never raises -
a failure here must never break the caller's real operation (order paid,
recharge approved, etc).
"""
from .models import Notification


def notify(user, type, title, body, link=''):
    """user: a User instance, or a raw user id (int)."""
    if user is None:
        return None
    try:
        kwargs = {'user': user} if hasattr(user, 'pk') else {'user_id': user}
        return Notification.objects.create(
            type=type, title=title, body=body, link=link, **kwargs,
        )
    except Exception:
        return None


def notify_bulk(user_ids, type, title, body, link=''):
    """user_ids: an iterable of user primary keys (e.g. a .values_list('id', flat=True) queryset)."""
    try:
        Notification.objects.bulk_create([
            Notification(user_id=uid, type=type, title=title, body=body, link=link)
            for uid in user_ids
        ], batch_size=500)
    except Exception:
        pass

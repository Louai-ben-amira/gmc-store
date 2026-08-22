"""
Thin helpers other apps call to create in-app notifications. Never raise -
a failure here must never break the caller's real operation (order paid,
recharge approved, etc).
"""
from django.db import transaction

from .messages import resolve
from .models import LINK_MAX, MAX_PER_USER, TITLE_MAX, Notification


def notify_user(user, type, title, body, link='/'):
    """
    Create one in-app notification and trim that user's history back to the
    newest MAX_PER_USER rows.

    `user` may be a User instance or a raw user id.
    """
    if user is None:
        return None
    try:
        user_id = user.pk if hasattr(user, 'pk') else user
        # Savepoint, not a bare try: several callers create notifications
        # from INSIDE their own transaction.atomic() (an order being paid, a
        # pre-order being fulfilled). On PostgreSQL a failed statement poisons
        # the whole transaction, so swallowing the error without rolling back
        # to a savepoint would break the caller's real work - exactly the
        # thing this helper promises never to do.
        with transaction.atomic():
            notification = Notification.objects.create(
                user_id=user_id, type=type,
                # Hard-truncate to the column widths. PostgreSQL rejects an
                # over-long value outright ("value too long for type character
                # varying") while SQLite happily stores it, so an unbounded
                # product name or ticket subject would be a prod-only 500.
                title=(title or '')[:TITLE_MAX],
                body=body or '',
                link=(link or '/')[:LINK_MAX],
            )
            _trim(user_id)
        return notification
    except Exception:
        return None


def _trim(user_id):
    """
    Drop everything past the newest MAX_PER_USER rows for this user.

    The ids are materialised into a list first: a sliced queryset can't be
    used directly inside __in on MySQL, and doing so on any backend risks a
    correlated DELETE that re-evaluates the slice mid-statement.
    """
    stale = list(
        Notification.objects.filter(user_id=user_id)
        .order_by('-created_at')
        .values_list('id', flat=True)[MAX_PER_USER:]
    )
    if stale:
        Notification.objects.filter(id__in=stale).delete()


def notify_event(user, key, link='/', **params):
    """
    Preferred entry point for the standard events: looks the copy up in
    messages.EVENTS and renders it in the recipient's own language, so an
    Arabic user gets Arabic and an English user gets English from one call.
    """
    if user is None:
        return None
    try:
        lang = getattr(user, 'language_preference', 'en') or 'en'
        type_, title, body = resolve(key, lang, **params)
        return notify_user(user, type_, title, body, link)
    except Exception:
        return None


# Legacy alias: plenty of existing call sites import `notify`. Keeping it
# pointed at notify_user means they all pick up the trimming for free.
notify = notify_user


def notify_bulk_event(user_ids, key, link='/', **params):
    """
    Bulk-send one catalogue event to many users, still in each recipient's own
    language. Users are grouped by language_preference so this stays one
    bulk_create per language (two, in practice) instead of one insert each.
    """
    from django.contrib.auth import get_user_model

    try:
        rows = (
            get_user_model().objects
            .filter(id__in=list(user_ids))
            .values_list('id', 'language_preference')
        )
        by_lang = {}
        for uid, lang in rows:
            by_lang.setdefault(lang or 'en', []).append(uid)

        for lang, ids in by_lang.items():
            type_, title, body = resolve(key, lang, **params)
            notify_bulk(ids, type_, title, body, link)
    except Exception:
        pass


def notify_bulk(user_ids, type, title, body, link='/'):
    """
    One row per user in as few queries as possible - used by broadcasts and
    flash-sale blasts. Deliberately skips the per-user trim: running it for
    thousands of users would cost two queries each. Their next individual
    notification trims them back down.
    """
    try:
        with transaction.atomic():
            Notification.objects.bulk_create([
                Notification(
                    user_id=uid, type=type,
                    title=(title or '')[:TITLE_MAX], body=body or '',
                    link=(link or '/')[:LINK_MAX],
                )
                for uid in user_ids
            ], batch_size=500)
    except Exception:
        pass

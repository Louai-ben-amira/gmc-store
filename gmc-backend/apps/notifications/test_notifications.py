from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.notifications.models import LINK_MAX, MAX_PER_USER, TITLE_MAX, Notification
from apps.notifications.services import notify_bulk, notify_event, notify_user
from apps.notifications.tasks import broadcast_notification

User = get_user_model()


def make_user(username, lang='en', role='client', active=True):
    user = User.objects.create_user(username=username, email=f'{username}@t.com')
    user.language_preference = lang
    user.role = role
    user.is_active = active
    user.is_email_verified = True
    user.save()
    return user


def api_for(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


class NotifyUserTests(TestCase):

    def test_creates_notification_with_defaults(self):
        user = make_user('ahmed')
        notify_user(user, 'order_complete', 'Ready', 'Your code is ready')
        n = Notification.objects.get(user=user)
        self.assertEqual(n.type, 'order_complete')
        self.assertEqual(n.link, '/')      # default, not empty
        self.assertFalse(n.is_read)

    def test_accepts_a_raw_user_id(self):
        user = make_user('ahmed')
        notify_user(user.id, 'announcement', 'Hi', 'Body', '/shop')
        self.assertEqual(Notification.objects.filter(user=user).count(), 1)

    def test_history_is_trimmed_to_the_cap(self):
        user = make_user('ahmed')
        for i in range(MAX_PER_USER + 15):
            notify_user(user, 'announcement', f'#{i}', 'body')

        self.assertEqual(Notification.objects.filter(user=user).count(), MAX_PER_USER)
        # The newest survive, the oldest are gone
        titles = list(
            Notification.objects.filter(user=user)
            .order_by('-created_at').values_list('title', flat=True)
        )
        self.assertIn(f'#{MAX_PER_USER + 14}', titles)
        self.assertNotIn('#0', titles)

    def test_trimming_is_per_user(self):
        a, b = make_user('ahmed'), make_user('bob')
        for i in range(MAX_PER_USER + 5):
            notify_user(a, 'announcement', f'#{i}', 'body')
        notify_user(b, 'announcement', 'only one', 'body')

        self.assertEqual(Notification.objects.filter(user=a).count(), MAX_PER_USER)
        self.assertEqual(Notification.objects.filter(user=b).count(), 1)

    def test_never_raises_on_a_missing_user(self):
        self.assertIsNone(notify_user(None, 'announcement', 'x', 'y'))

    def test_a_db_error_is_swallowed_not_propagated(self):
        """The helper's core promise: a notification problem never reaches the caller."""
        from unittest.mock import patch

        from django.db import DatabaseError

        user = make_user('ahmed')
        with patch.object(
            Notification.objects, 'create', side_effect=DatabaseError('boom'),
        ):
            self.assertIsNone(notify_user(user, 'announcement', 'x', 'y'))


class OversizedContentTests(TestCase):
    """
    A long product name or ticket subject must never break the thing that
    triggered the notification. PostgreSQL rejects an over-long CharField
    outright; SQLite stores it happily - so without truncation this would be
    a bug that only ever appears in production.
    """

    def test_long_title_is_truncated_not_rejected(self):
        user = make_user('ahmed')
        notify_user(user, 'announcement', 'x' * 500, 'body')
        n = Notification.objects.get(user=user)
        self.assertEqual(len(n.title), TITLE_MAX)

    def test_long_link_is_truncated(self):
        user = make_user('ahmed')
        notify_user(user, 'announcement', 'title', 'body', '/' + 'a' * 500)
        self.assertEqual(len(Notification.objects.get(user=user).link), LINK_MAX)

    def test_bulk_path_truncates_too(self):
        user = make_user('ahmed')
        notify_bulk([user.id], 'announcement', 'y' * 400, 'body')
        self.assertEqual(len(Notification.objects.get(user=user).title), TITLE_MAX)

    def test_body_is_unbounded(self):
        """body is a TextField - long announcements must survive intact."""
        user = make_user('ahmed')
        notify_user(user, 'announcement', 'ok', 'z' * 5000)
        self.assertEqual(len(Notification.objects.get(user=user).body), 5000)


class BilingualEventTests(TestCase):
    """Copy follows each recipient's own language_preference."""

    def test_arabic_user_gets_arabic(self):
        user = make_user('ahmed', lang='ar')
        notify_event(user, 'order_complete', link='/orders/1', product='Valorant 1000 VP')
        n = Notification.objects.get(user=user)
        self.assertEqual(n.title, '✅ طلبك جاهز!')
        self.assertIn('Valorant 1000 VP', n.body)
        self.assertIn('اضغط لإظهار الكود', n.body)

    def test_english_user_gets_english(self):
        user = make_user('bob', lang='en')
        notify_event(user, 'order_complete', link='/orders/1', product='Valorant 1000 VP')
        n = Notification.objects.get(user=user)
        self.assertEqual(n.title, '✅ Your order is ready!')
        self.assertIn('tap to reveal your code', n.body)

    def test_type_comes_from_the_catalog(self):
        user = make_user('ahmed', lang='ar')
        notify_event(user, 'preorder_fulfilled', product='X', amount='30.30')
        self.assertEqual(Notification.objects.get(user=user).type, 'preorder_fulfilled')

    def test_missing_placeholder_does_not_explode(self):
        user = make_user('ahmed')
        notify_event(user, 'ticket_reply')          # no ticket_id / subject
        self.assertEqual(Notification.objects.filter(user=user).count(), 1)


class BulkEventTests(TestCase):
    """The bulk path still has to speak each recipient's language."""

    def test_groups_recipients_by_language(self):
        from apps.notifications.services import notify_bulk_event

        ar = make_user('ahmed', lang='ar')
        en = make_user('bob', lang='en')
        notify_bulk_event([ar.id, en.id], 'flash_sale',
                          link='/product/x', product='Valorant', pct=30)

        self.assertIn('عرض خاطف', Notification.objects.get(user=ar).title)
        self.assertIn('Flash sale is live', Notification.objects.get(user=en).title)
        # Params still interpolate on both sides
        self.assertIn('Valorant', Notification.objects.get(user=ar).body)
        self.assertIn('30', Notification.objects.get(user=en).body)

    def test_type_and_link_are_preserved(self):
        from apps.notifications.services import notify_bulk_event

        user = make_user('ahmed')
        notify_bulk_event([user.id], 'wishlist_price_drop',
                          link='/product/y', product='PUBG UC', price='19.00')
        n = Notification.objects.get(user=user)
        self.assertEqual(n.type, 'wishlist_price_drop')
        self.assertEqual(n.link, '/product/y')


class FeedEndpointTests(TestCase):

    def setUp(self):
        self.user = make_user('ahmed')
        self.api  = api_for(self.user)

    def test_feed_returns_notifications_and_unread_count(self):
        for i in range(3):
            notify_user(self.user, 'announcement', f'#{i}', 'body')
        Notification.objects.filter(title='#0').update(is_read=True)

        resp = self.api.get('/api/notifications/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['unread_count'], 2)
        self.assertEqual(len(resp.data['notifications']), 3)
        self.assertIn('time_ago', resp.data['notifications'][0])

    def test_feed_is_capped_at_20(self):
        for i in range(25):
            notify_user(self.user, 'announcement', f'#{i}', 'body')
        resp = self.api.get('/api/notifications/')
        self.assertEqual(len(resp.data['notifications']), 20)
        self.assertEqual(resp.data['unread_count'], 25)   # count is not capped

    def test_time_ago_follows_reader_language(self):
        notify_user(self.user, 'announcement', 'x', 'y')
        self.assertEqual(self.api.get('/api/notifications/').data['notifications'][0]['time_ago'], 'just now')

        self.user.language_preference = 'ar'
        self.user.save(update_fields=['language_preference'])
        self.assertEqual(self.api.get('/api/notifications/').data['notifications'][0]['time_ago'], 'الآن')

    def test_feed_only_shows_your_own(self):
        other = make_user('bob')
        notify_user(other, 'announcement', 'not yours', 'body')
        resp = self.api.get('/api/notifications/')
        self.assertEqual(len(resp.data['notifications']), 0)

    def test_anonymous_is_rejected(self):
        self.assertEqual(APIClient().get('/api/notifications/').status_code, 401)


class MarkReadTests(TestCase):

    def setUp(self):
        self.user = make_user('ahmed')
        self.api  = api_for(self.user)
        for i in range(4):
            notify_user(self.user, 'announcement', f'#{i}', 'body')

    def test_mark_specific_ids(self):
        ids = list(Notification.objects.filter(user=self.user).values_list('id', flat=True)[:2])
        resp = self.api.post('/api/notifications/mark-read/', {'ids': ids}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['updated'], 2)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 2)

    def test_mark_all(self):
        resp = self.api.post('/api/notifications/mark-read/', {'all': True}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)

    def test_empty_payload_is_rejected(self):
        self.assertEqual(
            self.api.post('/api/notifications/mark-read/', {}, format='json').status_code, 400,
        )

    def test_cannot_mark_someone_elses_read(self):
        other = make_user('bob')
        theirs = notify_user(other, 'announcement', 'x', 'y')
        self.api.post('/api/notifications/mark-read/', {'ids': [theirs.id]}, format='json')
        theirs.refresh_from_db()
        self.assertFalse(theirs.is_read)

    def test_delete_own_notification(self):
        n = Notification.objects.filter(user=self.user).first()
        self.assertEqual(self.api.delete(f'/api/notifications/{n.id}/').status_code, 204)
        self.assertFalse(Notification.objects.filter(id=n.id).exists())

    def test_cannot_delete_someone_elses(self):
        other  = make_user('bob')
        theirs = notify_user(other, 'announcement', 'x', 'y')
        self.assertEqual(self.api.delete(f'/api/notifications/{theirs.id}/').status_code, 404)
        self.assertTrue(Notification.objects.filter(id=theirs.id).exists())


class BroadcastTests(TestCase):

    def setUp(self):
        self.admin = make_user('boss', role='admin')
        self.api   = api_for(self.admin)

    def test_broadcast_reaches_every_active_user(self):
        clients = [make_user(f'c{i}') for i in range(5)]
        resp = self.api.post('/api/admin/notifications/broadcast/', {
            'title': '🎉 1000 users!', 'body': 'Thank you for trusting GMC Store', 'link': '/shop',
        }, format='json')
        self.assertEqual(resp.status_code, 202, resp.content)
        self.assertEqual(resp.data['recipients'], 6)     # 5 clients + the admin

        broadcast_notification('🎉 1000 users!', 'Thank you for trusting GMC Store', '/shop')
        for c in clients:
            n = Notification.objects.get(user=c)
            self.assertEqual(n.type, 'announcement')
            self.assertEqual(n.title, '🎉 1000 users!')
            self.assertEqual(n.link, '/shop')

    def test_inactive_users_are_skipped(self):
        make_user('ghost', active=False)
        active = make_user('live')
        broadcast_notification('Hi', 'Body')
        self.assertTrue(Notification.objects.filter(user=active).exists())
        self.assertFalse(Notification.objects.filter(user__username='ghost').exists())

    def test_broadcast_defaults_link_to_root(self):
        make_user('c1')
        broadcast_notification('Hi', 'Body')
        self.assertEqual(Notification.objects.first().link, '/')

    def test_batches_cover_everyone_past_one_batch(self):
        """BATCH is 500 - prove the loop doesn't stop after the first chunk."""
        from apps.notifications import tasks
        original, tasks.BATCH = tasks.BATCH, 3
        try:
            for i in range(7):
                make_user(f'u{i}')
            created = broadcast_notification('Hi', 'Body')
        finally:
            tasks.BATCH = original
        self.assertEqual(created, 8)                      # 7 + the admin
        self.assertEqual(Notification.objects.count(), 8)

    def test_audience_endpoint(self):
        for i in range(3):
            make_user(f'c{i}')
        resp = self.api.get('/api/admin/notifications/broadcast/audience/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['recipients'], 4)

    def test_client_cannot_broadcast(self):
        client_api = api_for(make_user('nosy'))
        resp = client_api.post('/api/admin/notifications/broadcast/', {
            'title': 'hacked', 'body': 'nope',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(Notification.objects.filter(title='hacked').exists())

    def test_blank_title_is_rejected(self):
        resp = self.api.post('/api/admin/notifications/broadcast/', {
            'title': '   ', 'body': 'x',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_external_link_is_rejected(self):
        resp = self.api.post('/api/admin/notifications/broadcast/', {
            'title': 'x', 'body': 'y', 'link': 'https://evil.example.com',
        }, format='json')
        self.assertEqual(resp.status_code, 400, resp.content)

    def test_bulk_helper_skips_the_per_user_trim(self):
        """notify_bulk is the fast path - it must not run 2 queries per user."""
        user = make_user('c1')
        notify_bulk([user.id] * 3, 'announcement', 'x', 'y')
        self.assertEqual(Notification.objects.filter(user=user).count(), 3)

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.preorders.models import PreOrder
from apps.products.models import Code, Product, ProductVariant
from apps.users.models import WalletTransaction

User = get_user_model()

# Price 30.00 + 1% fee = 30.30 charged at delivery
PRICE = Decimal('30.00')
FEE   = Decimal('0.30')
TOTAL = PRICE + FEE


def make_client(username, balance):
    user = User.objects.create_user(
        username=username, email=f'{username}@test.com', password='pass12345',
    )
    user.balance          = Decimal(balance)
    user.is_email_verified = True
    user.save()
    return user


class PreOrderBaseTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            name='Valorant 1000 VP', price=PRICE, visible=True, stock_count=0,
            allows_preorder=True, preorder_note='Stock expected in 3-5 days',
        )
        self.admin = User.objects.create_user(
            username='boss', email='boss@test.com', password='pass12345', role='admin',
        )
        self.admin.is_email_verified = True
        self.admin.save()
        self.admin_api = APIClient()
        self.admin_api.force_authenticate(self.admin)

    def api_for(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return api

    def place(self, user, product=None, variant=None, expect=201):
        body = {'product_id': (product or self.product).id}
        if variant is not None:
            body['variant_id'] = variant.id
        resp = self.api_for(user).post('/api/preorders/', body, format='json')
        self.assertEqual(resp.status_code, expect, resp.content)
        return resp


class PlacePreOrderTests(PreOrderBaseTest):

    def test_place_locks_price_and_assigns_queue_position(self):
        a, b = make_client('ahmed', '50.00'), make_client('bob', '50.00')
        first  = self.place(a).data
        second = self.place(b).data

        self.assertEqual(first['queue_position'], 1)
        self.assertEqual(second['queue_position'], 2)
        self.assertEqual(Decimal(first['price_at_order']), PRICE)
        self.assertEqual(Decimal(first['total_price']), TOTAL)
        self.assertEqual(first['status'], 'pending')
        self.assertTrue(first['can_cancel'])

        # No money moved and no balance frozen
        a.refresh_from_db()
        self.assertEqual(a.balance, Decimal('50.00'))
        self.assertFalse(WalletTransaction.objects.filter(user=a).exists())

    def test_price_snapshot_survives_a_later_price_change(self):
        a = make_client('ahmed', '50.00')
        self.place(a)
        self.product.price = Decimal('99.00')
        self.product.save(update_fields=['price'])

        po = PreOrder.objects.get(user=a)
        self.assertEqual(po.price_at_order, PRICE)
        self.assertEqual(po.total_at_order, TOTAL)

    def test_cannot_preorder_twice_for_same_product(self):
        a = make_client('ahmed', '50.00')
        self.place(a)
        resp = self.place(a, expect=400)
        self.assertEqual(resp.data['error'], 'duplicate')

    def test_cannot_preorder_when_in_stock(self):
        Code.objects.create(product=self.product, code='IN-STOCK', status='available')
        self.product.stock_count = 1
        self.product.save(update_fields=['stock_count'])

        resp = self.place(make_client('ahmed', '50.00'), expect=400)
        self.assertEqual(resp.data['error'], 'in_stock')

    def test_cannot_preorder_when_disabled_on_product(self):
        self.product.allows_preorder = False
        self.product.save(update_fields=['allows_preorder'])
        self.place(make_client('ahmed', '50.00'), expect=400)

    def test_unverified_email_is_rejected(self):
        user = make_client('newbie', '50.00')
        user.is_email_verified = False
        user.save(update_fields=['is_email_verified'])
        resp = self.api_for(user).post(
            '/api/preorders/', {'product_id': self.product.id}, format='json',
        )
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_balance_is_never_required_to_place(self):
        broke = make_client('broke', '0.00')
        self.place(broke)   # 201 - the balance check happens at delivery

    def test_product_page_exposes_queue_and_own_preorder(self):
        a = make_client('ahmed', '50.00')
        self.place(a)
        self.place(make_client('bob', '50.00'))

        resp = self.api_for(a).get(f'/api/products/{self.product.id}/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(resp.data['allows_preorder'])
        self.assertEqual(resp.data['preorder_note'], 'Stock expected in 3-5 days')
        self.assertEqual(resp.data['preorder_queue'], 2)
        self.assertEqual(resp.data['my_preorder']['queue_position'], 1)

        # A visitor with no pre-order sees the queue but no personal entry
        resp = self.api_for(make_client('carol', '50.00')).get(f'/api/products/{self.product.id}/')
        self.assertEqual(resp.data['preorder_queue'], 2)
        self.assertIsNone(resp.data['my_preorder'])


class CancelPreOrderTests(PreOrderBaseTest):

    def test_cancel_inside_window_frees_the_spot_and_renumbers(self):
        a, b, c = (make_client(n, '50.00') for n in ('ahmed', 'bob', 'carol'))
        first  = self.place(a).data
        self.place(b)
        self.place(c)

        resp = self.api_for(a).post(f"/api/preorders/{first['id']}/cancel/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['status'], 'cancelled')

        self.assertEqual(PreOrder.objects.get(user=b).queue_position, 1)
        self.assertEqual(PreOrder.objects.get(user=c).queue_position, 2)
        # Nothing to refund - nothing was ever charged
        self.assertFalse(WalletTransaction.objects.exists())

    def test_cancel_after_24h_is_refused(self):
        a  = make_client('ahmed', '50.00')
        po = PreOrder.objects.get(pk=self.place(a).data['id'])
        PreOrder.objects.filter(pk=po.pk).update(
            created_at=timezone.now() - timedelta(hours=25),
        )

        resp = self.api_for(a).post(f'/api/preorders/{po.pk}/cancel/')
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.data['error'], 'window_closed')
        po.refresh_from_db()
        self.assertEqual(po.status, 'pending')

    def test_cannot_cancel_someone_elses_preorder(self):
        a  = make_client('ahmed', '50.00')
        po = self.place(a).data
        resp = self.api_for(make_client('bob', '50.00')).post(f"/api/preorders/{po['id']}/cancel/")
        self.assertEqual(resp.status_code, 404, resp.content)

    def test_can_cancel_flag_flips_after_the_window(self):
        a  = make_client('ahmed', '50.00')
        po = PreOrder.objects.get(pk=self.place(a).data['id'])
        self.assertTrue(po.can_cancel)
        PreOrder.objects.filter(pk=po.pk).update(created_at=timezone.now() - timedelta(hours=25))
        po.refresh_from_db()
        self.assertFalse(po.can_cancel)
        self.assertEqual(po.cancel_seconds_left, 0)


class ManualDeliveryTests(PreOrderBaseTest):

    def test_deliver_charges_client_and_creates_order_with_code(self):
        a  = make_client('ahmed', '50.00')
        po = self.place(a).data

        resp = self.admin_api.post(
            f"/api/admin/preorders/{po['id']}/deliver/",
            {'code': 'XXXX-YYYY-ZZZZ'}, format='json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        order = Order.objects.get(pk=resp.data['order_id'])
        self.assertEqual(order.user, a)
        self.assertEqual(order.product, self.product)
        self.assertEqual(order.amount_paid, TOTAL)
        self.assertEqual(order.service_fee, FEE)
        self.assertEqual(order.status, Order.Status.COMPLETED)
        self.assertEqual(order.code.code, 'XXXX-YYYY-ZZZZ')
        self.assertEqual(order.code.status, 'sold')

        a.refresh_from_db()
        self.assertEqual(a.balance, Decimal('50.00') - TOTAL)
        tx = WalletTransaction.objects.get(user=a)
        self.assertEqual(tx.type, 'debit')
        self.assertEqual(tx.amount, TOTAL)

        db_po = PreOrder.objects.get(pk=po['id'])
        self.assertEqual(db_po.status, 'fulfilled')
        self.assertEqual(db_po.order_id, order.id)
        self.assertIsNotNone(db_po.fulfilled_at)

    def test_deliver_is_refused_when_balance_is_short(self):
        broke = make_client('broke', '5.00')
        po    = self.place(broke).data

        resp = self.admin_api.post(
            f"/api/admin/preorders/{po['id']}/deliver/", {'code': 'ABC'}, format='json',
        )
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.data['error'], 'insufficient_balance')
        self.assertEqual(Decimal(resp.data['needed']), TOTAL)
        self.assertEqual(Decimal(resp.data['available']), Decimal('5.00'))

        # Nothing was created or charged - the whole delivery rolled back
        self.assertFalse(Order.objects.exists())
        self.assertFalse(Code.objects.exists())
        broke.refresh_from_db()
        self.assertEqual(broke.balance, Decimal('5.00'))
        self.assertEqual(PreOrder.objects.get(pk=po['id']).status, 'pending')

    def test_delivering_renumbers_the_rest_of_the_queue(self):
        a, b = make_client('ahmed', '50.00'), make_client('bob', '50.00')
        first = self.place(a).data
        self.place(b)

        self.admin_api.post(
            f"/api/admin/preorders/{first['id']}/deliver/", {'code': 'AAA'}, format='json',
        )
        self.assertEqual(PreOrder.objects.get(user=b).queue_position, 1)

    def test_skip_flags_the_client_and_frees_the_queue(self):
        broke, b = make_client('broke', '1.00'), make_client('bob', '50.00')
        first = self.place(broke).data
        self.place(b)

        resp = self.admin_api.post(f"/api/admin/preorders/{first['id']}/skip/", {}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['status'], 'expired')
        self.assertEqual(PreOrder.objects.get(user=b).queue_position, 1)

    def test_requeue_puts_a_skipped_client_back_in_line(self):
        broke = make_client('broke', '1.00')
        po    = self.place(broke).data
        self.admin_api.post(f"/api/admin/preorders/{po['id']}/skip/", {}, format='json')

        resp = self.admin_api.post(f"/api/admin/preorders/{po['id']}/requeue/", {}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['status'], 'pending')
        self.assertEqual(resp.data['queue_position'], 1)

    def test_client_cannot_reach_admin_endpoints(self):
        a  = make_client('ahmed', '50.00')
        po = self.place(a).data
        resp = self.api_for(a).post(
            f"/api/admin/preorders/{po['id']}/deliver/", {'code': 'X'}, format='json',
        )
        self.assertEqual(resp.status_code, 403, resp.content)


class AutoFulfillTests(PreOrderBaseTest):

    def test_uploading_codes_fulfills_the_queue_fifo(self):
        a, b, c = (make_client(n, '50.00') for n in ('ahmed', 'bob', 'carol'))
        for user in (a, b, c):
            self.place(user)

        resp = self.admin_api.post(
            f'/api/products/{self.product.id}/codes/',
            {'codes': ['CODE-1', 'CODE-2']}, format='json',
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data['preorders']['fulfilled'], 2)
        self.assertEqual(resp.data['preorders']['no_stock'], 1)

        # FIFO: the two oldest pre-orders got the two codes, in order
        self.assertEqual(Order.objects.get(user=a).code.code, 'CODE-1')
        self.assertEqual(Order.objects.get(user=b).code.code, 'CODE-2')
        self.assertFalse(Order.objects.filter(user=c).exists())

        # Carol keeps her spot and is now first in line
        carol_po = PreOrder.objects.get(user=c)
        self.assertEqual(carol_po.status, 'pending')
        self.assertEqual(carol_po.queue_position, 1)

        # Stock went straight to the queue, not to the shelf
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_count, 0)

    def test_short_balance_is_skipped_and_the_queue_moves_on(self):
        broke, b = make_client('broke', '2.00'), make_client('bob', '50.00')
        self.place(broke)
        self.place(b)

        resp = self.admin_api.post(
            f'/api/products/{self.product.id}/codes/', {'codes': ['ONLY-CODE']}, format='json',
        )
        result = resp.data['preorders']
        self.assertEqual(result['skipped'], 1)
        self.assertEqual(result['fulfilled'], 1)

        self.assertEqual(PreOrder.objects.get(user=broke).status, 'expired')
        self.assertEqual(Order.objects.get(user=b).code.code, 'ONLY-CODE')
        broke.refresh_from_db()
        self.assertEqual(broke.balance, Decimal('2.00'))

    def test_explicit_auto_fulfill_endpoint(self):
        a = make_client('ahmed', '50.00')
        self.place(a)
        # Codes added directly, bypassing the upload hook
        Code.objects.create(product=self.product, code='MANUAL-STOCK', status='available')
        self.product.stock_count = 1
        self.product.save(update_fields=['stock_count'])

        resp = self.admin_api.post(f'/api/admin/preorders/auto-fulfill/{self.product.id}/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['fulfilled'], 1)
        self.assertEqual(Order.objects.get(user=a).code.code, 'MANUAL-STOCK')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_count, 0)

    def test_no_code_is_ever_handed_to_two_clients(self):
        a, b = make_client('ahmed', '50.00'), make_client('bob', '50.00')
        self.place(a)
        self.place(b)
        self.admin_api.post(
            f'/api/products/{self.product.id}/codes/', {'codes': ['SOLO']}, format='json',
        )
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Code.objects.filter(status='sold').count(), 1)


class VariantPreOrderTests(PreOrderBaseTest):

    def setUp(self):
        super().setUp()
        self.product.has_variants = True
        self.product.save(update_fields=['has_variants'])
        self.v1000 = ProductVariant.objects.create(
            product=self.product, label='1000 VP', price=PRICE, stock_count=0,
        )
        self.v2050 = ProductVariant.objects.create(
            product=self.product, label='2050 VP', price=Decimal('60.00'), stock_count=0,
        )

    def test_variant_is_required_and_priced_from_the_variant(self):
        a = make_client('ahmed', '100.00')
        self.place(a, expect=400)                       # no variant chosen
        data = self.place(a, variant=self.v2050).data
        self.assertEqual(Decimal(data['price_at_order']), Decimal('60.00'))
        self.assertEqual(data['variant_label'], '2050 VP')

    def test_same_client_may_queue_for_two_different_variants(self):
        a = make_client('ahmed', '200.00')
        self.place(a, variant=self.v1000)
        self.place(a, variant=self.v2050)
        self.assertEqual(PreOrder.objects.filter(user=a, status='pending').count(), 2)

    def test_variant_restock_fulfills_only_that_variant(self):
        a, b = make_client('ahmed', '100.00'), make_client('bob', '100.00')
        self.place(a, variant=self.v1000)
        self.place(b, variant=self.v2050)

        resp = self.admin_api.patch(
            f'/api/products/{self.product.id}/variants/{self.v1000.id}/',
            {'stock_count': 1}, format='json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['preorders']['fulfilled'], 1)

        self.assertEqual(PreOrder.objects.get(user=a).status, 'fulfilled')
        self.assertEqual(PreOrder.objects.get(user=b).status, 'pending')

        order = Order.objects.get(user=a)
        self.assertEqual(order.variant, self.v1000)
        self.assertIsNone(order.code)          # variants never use Code rows
        self.v1000.refresh_from_db()
        self.assertEqual(self.v1000.stock_count, 0)


class AdminQueueViewTests(PreOrderBaseTest):

    def test_queue_shows_affordability_at_a_glance(self):
        rich, broke = make_client('rich', '50.00'), make_client('broke', '5.00')
        self.place(rich)
        self.place(broke)

        resp = self.admin_api.get(f'/api/admin/preorders/by-product/{self.product.id}/')
        self.assertEqual(resp.status_code, 200, resp.content)
        queue = resp.data['queue']
        self.assertEqual(len(queue), 2)
        self.assertEqual(queue[0]['client_username'], 'rich')
        self.assertTrue(queue[0]['can_afford'])
        self.assertFalse(queue[1]['can_afford'])
        self.assertEqual(Decimal(queue[1]['shortfall']), TOTAL - Decimal('5.00'))

    def test_list_filters_by_status_and_product(self):
        a = make_client('ahmed', '50.00')
        self.place(a)
        resp = self.admin_api.get('/api/admin/preorders/', {'status': 'pending'})
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['count'], 1)
        resp = self.admin_api.get('/api/admin/preorders/', {'status': 'fulfilled'})
        self.assertEqual(resp.data['count'], 0)

    def test_badge_and_stats_count_pending_preorders(self):
        self.place(make_client('ahmed', '50.00'))
        self.assertEqual(self.admin_api.get('/api/admin/badge-counts/').data['preorders'], 1)
        self.assertEqual(self.admin_api.get('/api/admin/stats/').data['pending_preorders'], 1)


class CancelReminderTaskTests(PreOrderBaseTest):

    def test_reminder_fires_once_inside_the_final_hour(self):
        from apps.notifications.models import Notification
        from apps.preorders.tasks import send_preorder_cancel_reminders

        a  = make_client('ahmed', '50.00')
        po = PreOrder.objects.get(pk=self.place(a).data['id'])

        # Not due yet (placed 2h ago)
        PreOrder.objects.filter(pk=po.pk).update(created_at=timezone.now() - timedelta(hours=2))
        send_preorder_cancel_reminders()
        self.assertFalse(Notification.objects.filter(type='preorder_reminder').exists())

        # Due: window closes in ~30 minutes
        PreOrder.objects.filter(pk=po.pk).update(
            created_at=timezone.now() - timedelta(hours=23, minutes=30),
        )
        send_preorder_cancel_reminders()
        self.assertEqual(Notification.objects.filter(type='preorder_reminder').count(), 1)

        # Idempotent - a second run sends nothing
        send_preorder_cancel_reminders()
        self.assertEqual(Notification.objects.filter(type='preorder_reminder').count(), 1)

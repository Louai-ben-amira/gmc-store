from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order

User = get_user_model()


class AdminOrdersBadgeTests(TestCase):
    """The orders badge is a 'new orders since last visit' notification."""

    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client1', email='c1@test.com', password='pass12345'
        )
        self.admin = User.objects.create_user(
            username='admin1', email='a1@test.com', password='pass12345'
        )
        self.admin.role = 'admin'
        self.admin.save()
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def make_order(self):
        return Order.objects.create(
            user=self.client_user, amount_paid=Decimal('10.00'),
            status=Order.Status.COMPLETED,
        )

    def badge(self):
        resp = self.api.get('/api/admin/badge-counts/')
        self.assertEqual(resp.status_code, 200)
        return resp.data['orders']

    def test_new_orders_counted_then_cleared_on_seen(self):
        self.make_order()
        self.make_order()
        self.assertEqual(self.badge(), 2)

        # Admin opens the Orders page -> frontend calls the seen endpoint
        resp = self.api.post('/api/admin/orders/seen/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.badge(), 0)

        # A new order arrives afterwards -> badge shows exactly 1
        self.make_order()
        self.assertEqual(self.badge(), 1)

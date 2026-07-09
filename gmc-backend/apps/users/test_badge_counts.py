from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order

User = get_user_model()


class AdminBadgeCountsTests(TestCase):
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

    def make_order(self, status, escrow_held):
        return Order.objects.create(
            user=self.client_user, amount_paid=Decimal('10.00'),
            status=status, escrow_held=escrow_held,
        )

    def test_orders_badge_counts_only_actionable(self):
        # Needs admin action: in escrow, not yet delivered
        self.make_order(Order.Status.PAID_ESCROW, escrow_held=True)
        self.make_order(Order.Status.IN_PROGRESS, escrow_held=True)
        # Disputed always counts
        self.make_order(Order.Status.DISPUTED, escrow_held=False)
        # Delivered, waiting on the BUYER to confirm - must NOT count
        self.make_order(Order.Status.COMPLETED, escrow_held=True)
        self.make_order(Order.Status.COMPLETED, escrow_held=True)
        # Fully closed - must not count
        self.make_order(Order.Status.CLOSED, escrow_held=False)

        resp = self.api.get('/api/admin/badge-counts/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['orders'], 3)

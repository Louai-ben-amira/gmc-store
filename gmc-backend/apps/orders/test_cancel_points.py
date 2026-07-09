from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.products.models import Product, Code

User = get_user_model()


def make_completed_order(user, product, points_earned=0, points_used=0):
    code = Code.objects.create(product=product, code='TEST-CODE', status='sold')
    order = Order.objects.create(
        user=user, product=product, code=code,
        amount_paid=Decimal('10.00'),
        points_earned=points_earned,
        points_used=points_used,
        status=Order.Status.COMPLETED,
    )
    code.order = order
    code.save()
    return order


class CancelOrderPointsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='client1', email='c1@test.com', password='pass12345'
        )
        self.admin = User.objects.create_user(
            username='admin1', email='a1@test.com', password='pass12345',
            is_staff=True, is_superuser=True,
        )
        self.admin.role = 'admin'
        self.admin.save()
        self.product = Product.objects.create(name='Test Product', price=Decimal('10.00'), visible=True)
        self.client_api = APIClient()

    def test_client_cancel_reverses_earned_points(self):
        # User earned 50 points from the order; balance state: 50 points, 0 balance
        self.user.points = 50
        self.user.balance = Decimal('0')
        self.user.save()
        order = make_completed_order(self.user, self.product, points_earned=50, points_used=0)

        self.client_api.force_authenticate(self.user)
        resp = self.client_api.post(f'/api/orders/{order.id}/cancel/')
        self.assertEqual(resp.status_code, 200, resp.content)

        self.user.refresh_from_db()
        self.assertEqual(self.user.points, 0)          # earned points revoked
        self.assertEqual(self.user.balance, Decimal('10.00'))  # money refunded

    def test_client_cancel_returns_redeemed_points(self):
        # User redeemed 100 points on the order and earned 20
        self.user.points = 20  # earned 20 at purchase, spent 100
        self.user.balance = Decimal('0')
        self.user.save()
        order = make_completed_order(self.user, self.product, points_earned=20, points_used=100)

        self.client_api.force_authenticate(self.user)
        resp = self.client_api.post(f'/api/orders/{order.id}/cancel/')
        self.assertEqual(resp.status_code, 200, resp.content)

        self.user.refresh_from_db()
        # 20 + (100 returned - 20 reversed) = 100
        self.assertEqual(self.user.points, 100)

    def test_client_cancel_clamps_at_zero(self):
        # User already spent the earned points elsewhere
        self.user.points = 10
        self.user.save()
        order = make_completed_order(self.user, self.product, points_earned=50, points_used=0)

        self.client_api.force_authenticate(self.user)
        resp = self.client_api.post(f'/api/orders/{order.id}/cancel/')
        self.assertEqual(resp.status_code, 200, resp.content)

        self.user.refresh_from_db()
        self.assertEqual(self.user.points, 0)  # clamped, not negative

    def test_admin_cancel_reverses_earned_points(self):
        self.user.points = 50
        self.user.balance = Decimal('0')
        self.user.save()
        order = make_completed_order(self.user, self.product, points_earned=50, points_used=0)

        self.client_api.force_authenticate(self.admin)
        resp = self.client_api.post(f'/api/admin/orders/{order.id}/cancel/')
        self.assertEqual(resp.status_code, 200, resp.content)

        self.user.refresh_from_db()
        self.assertEqual(self.user.points, 0)
        self.assertEqual(self.user.balance, Decimal('10.00'))

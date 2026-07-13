from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.products.models import Product, Code

User = get_user_model()


class QuantityOrderTests(TestCase):
    """A quantity>1 purchase creates ONE order holding all N codes."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='client1', email='c1@test.com', password='pass12345'
        )
        self.user.balance = Decimal('100.00')
        self.user.save()
        self.product = Product.objects.create(
            name='Test Product', price=Decimal('3.80'), visible=True, stock_count=3
        )
        for i in range(3):
            Code.objects.create(product=self.product, code=f'CODE-{i}', status='available')
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def place_qty3(self):
        resp = self.api.post('/api/orders/', {
            'product_id': self.product.id, 'quantity': 3,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.data

    def test_quantity_purchase_creates_single_order(self):
        data = self.place_qty3()
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)
        order = Order.objects.get(pk=data['id'])
        self.assertEqual(order.quantity, 3)
        self.assertEqual(order.codes.count(), 3)
        # amount_paid stores the purchase total (unit price + 1% fee, x3)
        unit = Decimal('3.80') + (Decimal('3.80') * Decimal('0.01')).quantize(Decimal('0.01'))
        self.assertEqual(order.amount_paid, unit * 3)
        self.user.refresh_from_db()
        self.assertEqual(self.user.balance, Decimal('100.00') - unit * 3)

    def test_reveal_returns_all_codes(self):
        data = self.place_qty3()
        resp = self.api.post(f"/api/orders/{data['id']}/reveal-code/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(sorted(resp.data['codes']), ['CODE-0', 'CODE-1', 'CODE-2'])

    def test_cancel_refunds_total_and_returns_all_codes(self):
        data = self.place_qty3()
        resp = self.api.post(f"/api/orders/{data['id']}/cancel/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.balance, Decimal('100.00'))
        self.assertEqual(
            Code.objects.filter(product=self.product, status='available').count(), 3
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_count, 3)

    def test_serializer_exposes_code_values_after_reveal(self):
        data = self.place_qty3()
        # Before reveal the client must not see any codes
        resp = self.api.get(f"/api/orders/{data['id']}/")
        self.assertEqual(resp.data['code_values'], [])
        self.api.post(f"/api/orders/{data['id']}/reveal-code/")
        resp = self.api.get(f"/api/orders/{data['id']}/")
        self.assertEqual(sorted(resp.data['code_values']), ['CODE-0', 'CODE-1', 'CODE-2'])
        self.assertEqual(resp.data['quantity'], 3)

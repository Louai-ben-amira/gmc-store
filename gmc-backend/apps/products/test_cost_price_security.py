from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.products.models import Product, ProductVariant

User = get_user_model()


class CostPriceNeverLeaksToClientsTests(TestCase):
    """
    cost_price / profit data is admin-only. This test locks in that a regular
    client can never see it, on either the product endpoints or their own
    order history, while an admin hitting the same endpoints does see it.
    """

    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client1', email='c1@test.com', password='pass12345'
        )
        self.admin = User.objects.create_user(
            username='admin1', email='a1@test.com', password='pass12345'
        )
        self.admin.role = 'admin'
        self.admin.save()

        self.product = Product.objects.create(
            name='Test Product', price=Decimal('31.00'), cost_price=Decimal('22.00'),
            visible=True, stock_count=10,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, label='1000 VP',
            price=Decimal('31.00'), cost_price=Decimal('22.00'),
        )
        self.order = Order.objects.create(
            user=self.client_user, product=self.product,
            amount_paid=Decimal('31.31'), status=Order.Status.COMPLETED,
            cost_price_at_sale=Decimal('22.00'), profit_at_sale=Decimal('9.31'),
        )

        self.anon    = APIClient()
        self.client_api = APIClient()
        self.client_api.force_authenticate(self.client_user)
        self.admin_api  = APIClient()
        self.admin_api.force_authenticate(self.admin)

    def test_public_product_list_excludes_cost_price(self):
        resp = self.anon.get('/api/products/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results', resp.data)
        self.assertTrue(len(results) >= 1)
        for row in results:
            self.assertNotIn('cost_price', row)
            self.assertNotIn('margin_pct', row)
            for v in row.get('variants', []):
                self.assertNotIn('cost_price', v)

    def test_authenticated_client_product_detail_excludes_cost_price(self):
        resp = self.client_api.get(f'/api/products/{self.product.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('cost_price', resp.data)
        self.assertNotIn('margin_pct', resp.data)

    def test_admin_product_list_includes_cost_price(self):
        resp = self.admin_api.get('/api/products/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results', resp.data)
        row = next(r for r in results if r['id'] == self.product.id)
        self.assertEqual(row['cost_price'], '22.00')
        self.assertIsNotNone(row['margin_pct'])

    def test_client_order_list_excludes_cost_and_profit(self):
        resp = self.client_api.get('/api/orders/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results', resp.data)
        row = next(r for r in results if r['id'] == self.order.id)
        self.assertIsNone(row['cost_price_at_sale'])
        self.assertIsNone(row['profit_at_sale'])
        self.assertIsNone(row['margin_pct_at_sale'])
        # And the nested product_detail must not carry cost_price either.
        self.assertNotIn('cost_price', row['product_detail'])

    def test_admin_order_list_includes_cost_and_profit(self):
        resp = self.admin_api.get('/api/admin/orders/')
        self.assertEqual(resp.status_code, 200)
        row = next(r for r in resp.data['results'] if r['id'] == self.order.id)
        self.assertEqual(Decimal(row['cost_price_at_sale']), Decimal('22.00'))
        self.assertEqual(Decimal(row['profit_at_sale']), Decimal('9.31'))
        self.assertIsNotNone(row['margin_pct_at_sale'])

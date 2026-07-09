from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.payments.models import CryptoPayment, RechargeRequest

User = get_user_model()


class AdminCryptoTxHashTests(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client1', email='c1@test.com', password='pass12345'
        )
        self.admin = User.objects.create_user(
            username='admin1', email='a1@test.com', password='pass12345'
        )
        self.admin.role = 'admin'
        self.admin.save()

        self.recharge = RechargeRequest.objects.create(
            user=self.client_user, method='crypto',
            amount_sent=Decimal('10.00'), wallet_credit=Decimal('10.00'),
        )
        self.crypto = CryptoPayment.objects.create(
            recharge_request=self.recharge,
            currency='BNB', wallet_address='0xabc',
            amount_crypto=Decimal('0.005'), amount_dt=Decimal('10.00'),
            exchange_rate=Decimal('1860'),
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        self.url = f'/api/payments/admin/crypto/{self.crypto.id}/'

    def test_approve_without_tx_hash_is_rejected(self):
        resp = self.api.patch(self.url, {'action': 'approve'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('TX hash is required', resp.data['detail'])

        # Nothing must have been credited or finalized
        self.client_user.refresh_from_db()
        self.crypto.refresh_from_db()
        self.recharge.refresh_from_db()
        self.assertEqual(self.client_user.balance, Decimal('0'))
        self.assertEqual(self.crypto.status, 'pending')
        self.assertEqual(self.recharge.status, 'pending')

    def test_approve_with_admin_entered_tx_hash_succeeds(self):
        resp = self.api.patch(
            self.url, {'action': 'approve', 'tx_hash': '0xdeadbeef'}, format='json'
        )
        self.assertEqual(resp.status_code, 200, resp.data)

        self.client_user.refresh_from_db()
        self.crypto.refresh_from_db()
        self.assertEqual(self.client_user.balance, Decimal('10.00'))
        self.assertEqual(self.crypto.status, 'confirmed')
        self.assertEqual(self.crypto.tx_hash, '0xdeadbeef')

    def test_approve_with_client_submitted_tx_hash_succeeds(self):
        # Client already submitted the hash; admin approves without typing one
        self.crypto.tx_hash = '0xclienthash'
        self.crypto.status = 'confirming'
        self.crypto.save()

        resp = self.api.patch(self.url, {'action': 'approve'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.balance, Decimal('10.00'))

    def test_binance_error_message_mentions_order_id(self):
        self.crypto.currency = 'BINANCE'
        self.crypto.save()

        resp = self.api.patch(self.url, {'action': 'approve'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Binance Order ID is required', resp.data['detail'])

    def test_reject_still_works_without_tx_hash(self):
        resp = self.api.patch(
            self.url, {'action': 'reject', 'admin_note': 'no payment received'}, format='json'
        )
        self.assertEqual(resp.status_code, 200, resp.data)

        self.crypto.refresh_from_db()
        self.recharge.refresh_from_db()
        self.assertEqual(self.crypto.status, 'expired')
        self.assertEqual(self.recharge.status, 'rejected')

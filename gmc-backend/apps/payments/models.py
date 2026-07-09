from decimal import Decimal

from django.db import models
from django.conf import settings
from django.utils import timezone


class SiteSettings(models.Model):
    """Key-value store for admin-configurable site settings."""
    key   = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True)
    label = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name        = 'Site Setting'
        verbose_name_plural = 'Site Settings'
        ordering            = ['key']

    def __str__(self):
        return f"{self.key} = {self.value[:50]}"

    @classmethod
    def get(cls, key, default=''):
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set(cls, key, value, label=''):
        obj, _ = cls.objects.update_or_create(
            key=key, defaults={'value': value, 'label': label}
        )
        return obj


class RechargeRequest(models.Model):
    METHOD_CHOICES = [
        ('ooredoo_ticket', 'Ooredoo Ticket'),
        ('orange_ticket',  'Orange Ticket'),
        ('d17_number',     'D17 - Phone Number'),
        ('d17_address',    'D17 - Address/RIB'),
        ('bank_transfer',  'Bank Transfer (Bancaire)'),
        ('edinar',         'E-Dinar'),
        ('flouci',         'Flouci'),
        # Legacy methods - kept so historical records remain valid
        ('d17',             'D17 (legacy)'),
        ('baridimob',       'BaridiMob'),
        ('dahabia',         'Dahabia / E-DINAR'),
        ('bank',            'Bank Transfer (legacy)'),
        ('cash',            'Cash'),
        ('tunisie_telecom', 'Tunisie Telecom'),
        ('crypto',          'Cryptocurrency'),
    ]
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='recharge_requests',
    )
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)

    # Ticket methods (Ooredoo / Orange)
    ticket_code  = models.CharField(max_length=50, blank=True)
    ticket_value = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Face value of the physical/digital ticket',
    )

    # D17 direct transfer methods
    amount_sent = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Amount the client sent via D17',
    )

    # Server-calculated - never set by client
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal('0'),
        help_text='0.11 for ticket methods, 0 for D17',
    )
    wallet_credit = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0'),
        help_text='Final DT amount credited to wallet after tax',
    )

    # D17 authorization/reference number the client sees in their D17 app
    reference_code = models.CharField(max_length=50, blank=True)

    proof       = models.ImageField(upload_to='recharge_proofs/', blank=True, null=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    admin_note  = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reviewed_recharges',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Recharge #{self.id} – {self.user.username} – {self.wallet_credit} DT"

    TICKET_METHODS   = {'ooredoo_ticket', 'orange_ticket'}
    TRANSFER_METHODS = {'d17_number', 'd17_address', 'bank_transfer', 'flouci'}

    BANK_TRANSFER_FLAT_FEE = Decimal('2.5')

    def calculate_wallet_credit(self):
        """Compute tax_rate and wallet_credit from SiteSettings. Never hardcode rates."""
        if self.method in self.TICKET_METHODS:
            rate_str = SiteSettings.get('TICKET_TAX_RATE', '0.11')
            try:
                self.tax_rate = Decimal(rate_str)
            except Exception:
                self.tax_rate = Decimal('0.11')

            items = list(self.ticket_items.all()) if self.pk else []
            if items:
                total_credit = Decimal('0')
                for item in items:
                    item.credit = (item.value * (Decimal('1') - self.tax_rate)).quantize(Decimal('0.01'))
                    total_credit += item.credit
                RechargeTicketItem.objects.bulk_update(items, ['credit'])
                self.wallet_credit = total_credit
                return self.wallet_credit

            base = self.ticket_value or Decimal('0')
            self.wallet_credit = (base * (Decimal('1') - self.tax_rate)).quantize(Decimal('0.01'))
        elif self.method == 'bank_transfer':
            self.tax_rate = Decimal('0')
            sent = self.amount_sent or Decimal('0')
            self.wallet_credit = max(sent - self.BANK_TRANSFER_FLAT_FEE, Decimal('0')).quantize(Decimal('0.01'))
        elif self.method == 'd17_number':
            self.tax_rate = Decimal('0.01')
            sent = self.amount_sent or Decimal('0')
            fee = (sent * self.tax_rate).quantize(Decimal('0.01'))
            self.wallet_credit = max(sent - fee, Decimal('0')).quantize(Decimal('0.01'))
        else:
            self.tax_rate     = Decimal('0')
            self.wallet_credit = (self.amount_sent or Decimal('0')).quantize(Decimal('0.01'))
        return self.wallet_credit

    def save(self, *args, **kwargs):
        if self.method in self.TICKET_METHODS or self.method in self.TRANSFER_METHODS:
            self.calculate_wallet_credit()
        super().save(*args, **kwargs)

    def wallet_credit_description(self):
        if self.method in self.TICKET_METHODS:
            pct = int(self.tax_rate * 100)
            items = list(self.ticket_items.all())
            if items:
                total_value = sum((i.value for i in items), Decimal('0'))
                return (
                    f"{len(items)} ticket(s), {total_value} DT total – {pct}% fee = {self.wallet_credit} DT credited"
                )
            return (
                f"{self.ticket_value} DT ticket – {pct}% fee = {self.wallet_credit} DT credited"
            )
        return f"D17 transfer – {self.wallet_credit} DT credited"


class RechargeTicketItem(models.Model):
    """One physical/digital recharge ticket within a (possibly multi-ticket) RechargeRequest."""
    request = models.ForeignKey(RechargeRequest, on_delete=models.CASCADE, related_name='ticket_items')
    code    = models.CharField(max_length=50, unique=True)
    value   = models.DecimalField(max_digits=10, decimal_places=2)
    credit  = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))

    def __str__(self):
        return f"{self.code} ({self.value} DT)"


class GiftCardBatch(models.Model):
    """Admin-generated batch of gift card codes."""
    label          = models.CharField(max_length=200, blank=True)
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    quantity       = models.IntegerField(default=1)
    expires_at     = models.DateTimeField(null=True, blank=True)
    image          = models.ImageField(upload_to='gift_cards/', null=True, blank=True)
    linked_product = models.OneToOneField(
                         'products.Product', null=True, blank=True,
                         on_delete=models.SET_NULL, related_name='gift_card_batch'
                     )
    created_by = models.ForeignKey(
                     settings.AUTH_USER_MODEL, null=True, blank=True,
                     on_delete=models.SET_NULL, related_name='gift_card_batches'
                 )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name        = 'Gift Card Batch'
        verbose_name_plural = 'Gift Card Batches'

    def __str__(self):
        return f"Batch #{self.id} - {self.amount} DT × {self.quantity}"


class GiftCard(models.Model):
    batch      = models.ForeignKey(GiftCardBatch, on_delete=models.CASCADE, related_name='cards')
    code       = models.CharField(max_length=32, unique=True, db_index=True)
    redeemed_by = models.ForeignKey(
                      settings.AUTH_USER_MODEL, null=True, blank=True,
                      on_delete=models.SET_NULL, related_name='redeemed_gift_cards'
                  )
    redeemed_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        status = f"redeemed by {self.redeemed_by.username}" if self.redeemed_by else "available"
        return f"GiftCard {self.code} ({status})"

    @property
    def is_used(self):
        return self.redeemed_by is not None

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.batch.expires_at and timezone.now() > self.batch.expires_at


class CryptoPayment(models.Model):
    CURRENCY_CHOICES = [
        ('BINANCE', 'Binance (USDT)'),
        ('BNB',     'BNB'),
    ]
    STATUS_CHOICES = [
        ('pending',    'Pending'),
        ('confirming', 'Confirming'),
        ('confirmed',  'Confirmed'),
        ('expired',    'Expired'),
    ]

    recharge_request = models.OneToOneField(
        RechargeRequest, on_delete=models.CASCADE, related_name='crypto_payment',
    )
    currency       = models.CharField(max_length=20, choices=CURRENCY_CHOICES)
    wallet_address = models.CharField(max_length=200)
    amount_crypto  = models.DecimalField(max_digits=20, decimal_places=8)
    amount_dt      = models.DecimalField(max_digits=10, decimal_places=2)
    exchange_rate  = models.DecimalField(max_digits=20, decimal_places=8)
    tx_hash        = models.CharField(max_length=200, blank=True)
    status         = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    expires_at     = models.DateTimeField()
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Crypto #{self.id} – {self.currency} – {self.amount_dt} DT"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at and self.status == 'pending'

    WALLET_SETTING_KEYS = {
        'BINANCE': 'BINANCE_ADDRESS',
        'BNB':     'BNB_ADDRESS',
    }

    @classmethod
    def get_wallet_address(cls, currency):
        key = cls.WALLET_SETTING_KEYS.get(currency, '')
        return SiteSettings.get(key)

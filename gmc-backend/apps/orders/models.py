import json
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class PromoCode(models.Model):
    DISCOUNT_TYPE_CHOICES = [('percent', 'Percent'), ('fixed', 'Fixed')]
    code           = models.CharField(max_length=50, unique=True)
    discount_type  = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default='percent')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_uses       = models.IntegerField(default=0)
    used_count     = models.IntegerField(default=0)
    # When True, each user may redeem this code at most once, regardless of
    # max_uses (which only caps the total number of redemptions across all
    # users). Typical use: a "WELCOME" code any new account can use one time.
    one_per_user   = models.BooleanField(default=False)
    valid_until    = models.DateTimeField(null=True, blank=True)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.code

    def check_valid(self, user=None):
        if not self.is_active:
            return False, 'Promo code is not active.'
        if self.max_uses > 0 and self.used_count >= self.max_uses:
            return False, 'Promo code has reached its usage limit.'
        if self.valid_until and timezone.now() > self.valid_until:
            return False, 'Promo code has expired.'
        if self.one_per_user and user is not None and user.is_authenticated:
            if self.usages.filter(user=user).exists():
                return False, 'You have already used this promo code.'
        return True, None

    def calculate_discount(self, price):
        from decimal import Decimal
        price = Decimal(str(price))
        if self.discount_type == 'percent':
            return (price * Decimal(str(self.discount_value)) / 100).quantize(Decimal('0.01'))
        return min(Decimal(str(self.discount_value)), price)


class PromoCodeUsage(models.Model):
    """One row per (promo_code, user) redemption - enforces one_per_user at the DB level."""
    promo_code = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='usages')
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='promo_code_usages')
    order      = models.ForeignKey('Order', null=True, blank=True, on_delete=models.SET_NULL, related_name='promo_usage')
    used_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['promo_code', 'user'], name='unique_promo_usage_per_user'),
        ]

    def __str__(self):
        return f"{self.user.username} used {self.promo_code.code}"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_CREDENTIALS = 'pending_credentials', 'Pending Credentials'
        PAID_ESCROW         = 'paid_escrow',         'Paid - In Escrow'
        IN_PROGRESS         = 'in_progress',         'In Progress'
        COMPLETED           = 'completed',           'Completed'
        DISPUTED            = 'disputed',            'Disputed'
        CLOSED              = 'closed',              'Closed'
        # Legacy values - kept so existing rows don't break
        PENDING             = 'pending',             'Pending (legacy)'
        CANCELLED           = 'cancelled',           'Cancelled'

    # Legacy alias kept for old code that references SERVICE_STATUS_CHOICES directly
    SERVICE_STATUS_CHOICES = [
        ('pending',     'Pending'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
    ]

    user             = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    product          = models.ForeignKey('products.Product', null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    variant          = models.ForeignKey('products.ProductVariant', null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    bundle           = models.ForeignKey('products.Bundle', null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    code             = models.OneToOneField(
                           'products.Code', null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='order_ref'
                       )
    promo_code       = models.ForeignKey(PromoCode, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    amount_paid      = models.DecimalField(max_digits=10, decimal_places=2)
    service_fee      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points_earned    = models.IntegerField(default=0)
    points_used      = models.IntegerField(default=0)
    status           = models.CharField(max_length=25, choices=Status.choices, default=Status.PENDING)
    # Escrow: True while funds are held and not yet released to seller balance
    escrow_held      = models.BooleanField(default=False)
    # For requires_account orders: tracks the service delivery status (seller-side)
    service_status   = models.CharField(
                           max_length=15, choices=SERVICE_STATUS_CHOICES,
                           default='pending', blank=True
                       )
    requires_account = models.BooleanField(default=False)
    # Units purchased in this order. A quantity>1 purchase is ONE order holding
    # N codes (Code.order FK); amount_paid / points fields store purchase totals.
    quantity         = models.PositiveIntegerField(default=1)
    # Code reveal tracking - set on first client reveal
    code_viewed_at   = models.DateTimeField(null=True, blank=True)
    code_view_ip     = models.GenericIPAddressField(null=True, blank=True)
    # Groups the N orders created by a single quantity>1 purchase so the
    # client can display them as one purchase with multiple codes.
    batch_id         = models.UUIDField(null=True, blank=True, db_index=True)
    # Cost/profit snapshot at time of sale (admin-only, never serialized to
    # clients). Snapshotting means a later change to the product/variant's
    # cost_price never rewrites the profit history of past orders. Null when
    # cost was unknown (no cost_price set anywhere) at sale time.
    cost_price_at_sale = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    profit_at_sale     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            # User order history is the most common per-user query.
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        name = self.product.name if self.product else (self.bundle.name if self.bundle else 'N/A')
        return f"Order #{self.id} - {self.user.username} - {name}"

    @property
    def is_revealed(self):
        return self.code_viewed_at is not None

    @property
    def is_refund_eligible(self):
        """Client may cancel only if code has never been revealed."""
        return (
            self.code is not None
            and self.status == self.Status.COMPLETED
            and self.code_viewed_at is None
        )


class OrderCodeViewLog(models.Model):
    """Immutable audit log - one row per reveal attempt (idempotent on first reveal)."""
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='view_logs')
    viewed_at  = models.DateTimeField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-viewed_at']

    def __str__(self):
        return f"CodeView Order#{self.order_id} @ {self.viewed_at}"


class OrderCredentials(models.Model):
    order          = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='credentials')
    data_encrypted = models.TextField(blank=True)   # cleared on deletion, not the row itself
    is_used        = models.BooleanField(default=False)
    delivered_at   = models.DateTimeField(null=True, blank=True)
    revealed_at    = models.DateTimeField(null=True, blank=True)  # first seller reveal
    deleted_at     = models.DateTimeField(null=True, blank=True)  # payload purge timestamp
    created_at     = models.DateTimeField(auto_now_add=True)
    # Audit log - every reveal: {user_id, username, role, accessed_at, ip}
    access_log     = models.JSONField(default=list)

    class Meta:
        verbose_name_plural = 'order credentials'

    def __str__(self):
        return f"Credentials for Order #{self.order_id}"

    def set_data(self, data_dict):
        from apps.orders.encryption import encrypt_data
        self.data_encrypted = encrypt_data(json.dumps(data_dict))

    def get_data(self):
        from apps.orders.encryption import decrypt_data
        return json.loads(decrypt_data(self.data_encrypted))

    def log_access(self, user, ip=None):
        now = timezone.now()
        entry = {
            'user_id':     user.id,
            'username':    user.username,
            'role':        getattr(user, 'role', 'unknown'),
            'accessed_at': now.isoformat(),
            'ip':          ip,
        }
        if not isinstance(self.access_log, list):
            self.access_log = []
        self.access_log.append(entry)
        update_fields = ['access_log']
        if self.revealed_at is None:
            self.revealed_at = now
            update_fields.append('revealed_at')
        self.save(update_fields=update_fields)

    def purge_payload(self):
        """Zero out the encrypted payload; keep the row for audit."""
        self.data_encrypted = ''
        self.deleted_at = timezone.now()
        self.save(update_fields=['data_encrypted', 'deleted_at'])

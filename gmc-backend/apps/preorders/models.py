from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

# Same 1% service fee every purchase on the site pays (see apps.orders.views).
# Snapshotted per pre-order so a later rate change never rewrites what an
# existing pre-order was quoted.
SERVICE_FEE_RATE = Decimal('0.01')

# How long after placing a pre-order the client may still cancel it themselves.
CANCEL_WINDOW_HOURS = 24


class PreOrder(models.Model):
    """
    A client's reserved spot in the queue for an out-of-stock product.

    No money moves when the pre-order is placed and no balance is frozen -
    the client is charged only at the moment an admin delivers a code
    (manually, or automatically when stock arrives). The price they were
    quoted is snapshotted here so a later price change never applies
    retroactively.
    """

    STATUS_CHOICES = [
        ('pending',   'Pending'),      # waiting for stock - no payment taken yet
        ('fulfilled', 'Fulfilled'),    # code delivered, payment taken
        ('cancelled', 'Cancelled'),    # client cancelled inside the 24h window
        ('expired',   'Expired'),      # skipped at delivery: balance was short
        ('failed',    'Failed'),       # removed from the queue by an admin
    ]
    # Statuses that still occupy a slot in the live queue
    ACTIVE_STATUSES = ('pending',)

    user     = models.ForeignKey(
                   settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                   related_name='preorders',
               )
    product  = models.ForeignKey(
                   'products.Product', on_delete=models.CASCADE,
                   related_name='preorders',
               )
    variant  = models.ForeignKey(
                   'products.ProductVariant', null=True, blank=True,
                   on_delete=models.SET_NULL, related_name='preorders',
               )

    # Price snapshot taken when the pre-order was placed. Even if the admin
    # changes the product price later, the client pays what they saw.
    price_at_order       = models.DecimalField(max_digits=10, decimal_places=2)
    # The 1% service fee on that price, also snapshotted. Charged total is
    # price_at_order + service_fee_at_order (see total_at_order).
    service_fee_at_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    # 1-based position among the product's pending pre-orders. Recalculated
    # whenever someone ahead leaves the queue (see recalculate_queue).
    queue_position = models.IntegerField(default=0)

    created_at   = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)
    # Why a delivery attempt failed / the client was skipped - shown to admin
    failure_reason = models.CharField(max_length=200, blank=True)
    # Set once the "1 hour left to cancel for free" reminder has gone out, so
    # the hourly Beat task never sends it twice (see tasks.py).
    cancel_reminder_sent = models.BooleanField(default=False)

    # The order created when this pre-order was fulfilled
    order = models.ForeignKey(
                'orders.Order', null=True, blank=True,
                on_delete=models.SET_NULL, related_name='preorder_source',
            )

    class Meta:
        ordering = ['created_at']          # always FIFO - oldest first
        indexes = [
            # Hot path: the queue for one product, and a client's own list
            models.Index(fields=['product', 'status', 'created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        constraints = [
            # A client can hold at most one live pre-order per product+variant.
            # Partial unique index so cancelled/fulfilled rows never block a
            # new pre-order for the same combo.
            models.UniqueConstraint(
                fields=['user', 'product', 'variant'],
                condition=models.Q(status='pending'),
                name='unique_pending_preorder_per_variant',
            ),
            # The constraint above cannot cover variant-less pre-orders: in
            # PostgreSQL two NULLs never collide in a unique index, so every
            # (user, product, NULL) row would be considered distinct. Products
            # without variants are the common case, so they get their own
            # index that leaves the nullable column out entirely.
            models.UniqueConstraint(
                fields=['user', 'product'],
                condition=models.Q(status='pending', variant__isnull=True),
                name='unique_pending_preorder_no_variant',
            ),
        ]

    def __str__(self):
        label = f'{self.product.name}' + (f' - {self.variant.label}' if self.variant_id else '')
        return f'PreOrder #{self.pk} - {self.user.username} - {label} ({self.status})'

    # ── Money ──────────────────────────────────────────────────────────────

    @property
    def total_at_order(self):
        """What the client is charged at delivery: locked price + locked fee."""
        return (self.price_at_order or Decimal('0')) + (self.service_fee_at_order or Decimal('0'))

    # ── Cancellation window ────────────────────────────────────────────────

    @property
    def cancel_deadline(self):
        if not self.created_at:
            return None
        return self.created_at + timedelta(hours=CANCEL_WINDOW_HOURS)

    @property
    def can_cancel(self):
        if self.status != 'pending':
            return False
        return timezone.now() < self.cancel_deadline

    @property
    def cancel_seconds_left(self):
        """Seconds of free-cancellation left, 0 once the window has closed."""
        if self.status != 'pending' or not self.created_at:
            return 0
        remaining = (self.cancel_deadline - timezone.now()).total_seconds()
        return int(remaining) if remaining > 0 else 0

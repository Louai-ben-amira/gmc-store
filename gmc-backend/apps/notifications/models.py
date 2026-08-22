from django.conf import settings
from django.db import models

# How many notifications a single user keeps. Older ones are trimmed away
# every time a new one is created (see services.notify_user), so the table
# can't grow without bound as the store gets busier.
MAX_PER_USER = 50

# Column widths, shared with services.py so callers can be truncated safely
# rather than blowing up on PostgreSQL (which enforces them) after passing
# silently on SQLite (which does not).
TITLE_MAX = 100
LINK_MAX  = 200


class Notification(models.Model):
    TYPE_CHOICES = [
        ('order_complete',     'Order Complete'),
        ('recharge_approved',  'Recharge Approved'),
        ('recharge_rejected',  'Recharge Rejected'),
        ('ticket_reply',       'Ticket Reply'),
        ('referral_bonus',     'Referral Bonus'),
        ('tier_upgrade',       'VIP Tier Upgrade'),
        ('flash_sale',         'Flash Sale'),
        ('preorder_fulfilled', 'Pre-order Fulfilled'),
        ('preorder_failed',    'Pre-order Failed'),
        ('announcement',       'Announcement'),
        # Types outside the headline list above, kept because live code
        # already sends them - dropping them would silently break those flows.
        ('wishlist_price_drop', 'Wishlist Price Drop'),
        ('preorder_placed',     'Pre-order Placed'),
        ('preorder_reminder',   'Pre-order Cancel Window'),
    ]

    user       = models.ForeignKey(
                     settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                     related_name='notifications',
                 )
    type       = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=TITLE_MAX)
    body       = models.TextField()
    link       = models.CharField(max_length=LINK_MAX, blank=True, default='/')  # where a click navigates
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.type}] {self.user.username} - {self.title}"

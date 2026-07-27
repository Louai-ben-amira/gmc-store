from django.conf import settings
from django.db import models


class Notification(models.Model):
    TYPE_CHOICES = [
        ('order_complete',    'Order Complete'),
        ('recharge_approved', 'Recharge Approved'),
        ('recharge_rejected', 'Recharge Rejected'),
        ('ticket_reply',      'Ticket Reply'),
        ('referral_bonus',    'Referral Bonus'),
        ('flash_sale',        'Flash Sale'),
        ('wishlist_price_drop', 'Wishlist Price Drop'),
    ]

    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type       = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=100)
    body       = models.TextField()
    link       = models.CharField(max_length=200, blank=True)  # where to navigate on click
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"[{self.type}] {self.user.username} - {self.title}"

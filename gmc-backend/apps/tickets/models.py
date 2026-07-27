from django.db import models
from django.conf import settings


TICKET_STATUS_CHOICES = [
    ('open',        'Open'),
    ('in_progress', 'In Progress'),
    ('resolved',    'Resolved'),
    ('closed',      'Closed'),
]


class OrderTicket(models.Model):
    order       = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='tickets')
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='order_tickets')
    subject     = models.CharField(max_length=200)
    status      = models.CharField(max_length=15, choices=TICKET_STATUS_CHOICES, default='open')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['order', 'status']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"OrderTicket #{self.id} - Order #{self.order_id}"


class OrderTicketMessage(models.Model):
    ticket     = models.ForeignKey(OrderTicket, on_delete=models.CASCADE, related_name='messages')
    sender     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='order_ticket_messages')
    body       = models.TextField(blank=True)
    attachment = models.ImageField(upload_to='tickets/order/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read    = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} on OrderTicket #{self.ticket_id}"


class SupportTicket(models.Model):
    CATEGORY_CHOICES = [
        ('account',  'Account Issue'),
        ('payment',  'Payment Problem'),
        ('bug',      'Bug Report'),
        ('refund',   'Refund Request'),
        ('other',    'Other'),
    ]

    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_tickets')
    category    = models.CharField(max_length=15, choices=CATEGORY_CHOICES)
    subject     = models.CharField(max_length=200)
    status      = models.CharField(max_length=15, choices=TICKET_STATUS_CHOICES, default='open')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self):
        return f"SupportTicket #{self.id} - {self.subject}"


class SupportTicketMessage(models.Model):
    ticket     = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_ticket_messages')
    body       = models.TextField(blank=True)
    attachment = models.ImageField(upload_to='tickets/support/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read    = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} on SupportTicket #{self.ticket_id}"

from django.db import models
from django.conf import settings


class Conversation(models.Model):
    STATUS_CHOICES   = [('open', 'Open'), ('resolved', 'Resolved')]
    PRIORITY_CHOICES = [('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')]

    client          = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation')
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    priority        = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    last_message_at = models.DateTimeField(null=True, blank=True)
    unread_count    = models.IntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_at']

    def __str__(self):
        return f"Conversation with {self.client.username}"


class Message(models.Model):
    STATUS_CHOICES = [
        ('sent',      'Sent'),
        ('delivered', 'Delivered'),
        ('read',      'Read'),
    ]
    TYPE_CHOICES = [
        ('text',             'Text'),
        ('order_card',       'Order Card'),
        ('credentials_card', 'Credentials Card'),
        ('status_update',    'Status Update'),
    ]

    conversation  = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    body          = models.TextField(blank=True)
    attachment    = models.ImageField(upload_to='chat/', null=True, blank=True)
    msg_type      = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    metadata      = models.JSONField(default=dict, blank=True)
    status        = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    delivered_at  = models.DateTimeField(null=True, blank=True)
    read_at       = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    @property
    def is_read(self):
        return self.status == 'read'

    def __str__(self):
        return f"Message from {self.sender.username} in conv #{self.conversation.id}"


class CannedResponse(models.Model):
    shortcut   = models.CharField(max_length=50, unique=True)
    body       = models.TextField()
    used_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-used_count', 'shortcut']

    def __str__(self):
        return f"/{self.shortcut}"

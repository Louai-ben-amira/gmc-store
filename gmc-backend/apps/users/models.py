import random
import secrets
import string
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.db import models


def _generate_referral_code():
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=6))
    return f'GMC-{suffix}'


def generate_verify_token():
    """Cryptographically secure, url-safe token for email verification links."""
    return secrets.token_urlsafe(32)


class User(AbstractUser):
    ROLE_CHOICES = [('admin', 'Admin'), ('client', 'Client')]
    role          = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    balance       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points        = models.IntegerField(default=0)
    avatar        = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone         = models.CharField(max_length=20, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    last_seen     = models.DateTimeField(null=True, blank=True)
    # Admin only: when they last opened the admin Orders page - drives the
    # "new orders" notification badge in the admin sidebar
    orders_seen_at = models.DateTimeField(null=True, blank=True)
    referral_code      = models.CharField(max_length=12, unique=True, db_index=True, blank=True)
    theme_preference   = models.CharField(
                             max_length=5,
                             choices=[('dark', 'Dark'), ('light', 'Light')],
                             default='dark',
                         )
    language_preference = models.CharField(
                             max_length=2,
                             choices=[('en', 'English'), ('ar', 'Arabic')],
                             default='en',
                          )
    referred_by   = models.ForeignKey(
                        'self', null=True, blank=True,
                        on_delete=models.SET_NULL, related_name='referrals'
                    )

    # ── Email verification (new accounts only - see migration 0008) ─────────
    is_email_verified    = models.BooleanField(default=False)
    email_verify_token   = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    # Timestamp of most recent verification email sent - used to expire the link
    email_verify_sent_at = models.DateTimeField(null=True, blank=True)
    # How many times the client requested a resend - caps at 3, then soft-blocked
    email_resend_count   = models.IntegerField(default=0)
    # When they verified - audit trail
    email_verified_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.referral_code:
            code = _generate_referral_code()
            while User.objects.filter(referral_code=code).exists():
                code = _generate_referral_code()
            self.referral_code = code
        super().save(*args, **kwargs)


class WalletTransaction(models.Model):
    TYPE_CHOICES = [('credit', 'Credit'), ('debit', 'Debit')]
    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    type          = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount        = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    method        = models.CharField(max_length=50, blank=True)
    note          = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ReferralBonus(models.Model):
    referrer                   = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referral_bonuses_earned')
    referred_user              = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referral_bonus_source')
    amount                     = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('2.00'))
    was_eligible               = models.BooleanField()
    referrer_balance_at_signup = models.DecimalField(max_digits=10, decimal_places=2)
    created_at                 = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        eligible = 'credited' if self.was_eligible else 'skipped (balance too low)'
        return f"Referral: {self.referrer.username} ← {self.referred_user.username} - {eligible}"

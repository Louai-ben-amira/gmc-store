from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from .models import RechargeRequest, CryptoPayment, SiteSettings, GiftCardBatch, GiftCard
from apps.users.models import WalletTransaction


@admin.register(RechargeRequest)
class RechargeAdmin(admin.ModelAdmin):
    list_display    = ['id', 'user', 'wallet_credit', 'method', 'reference_code', 'status', 'created_at']
    list_filter     = ['status', 'method', 'created_at']
    search_fields   = ['user__username', 'ticket_code', 'reference_code']
    readonly_fields = ['wallet_credit', 'tax_rate', 'created_at', 'reviewed_at', 'reviewed_by']
    actions         = ['approve_selected', 'reject_selected']

    @admin.action(description='Approve selected recharge requests')
    def approve_selected(self, request, queryset):
        for recharge in queryset.filter(status='pending'):
            with transaction.atomic():
                recharge.status      = 'approved'
                recharge.reviewed_at = timezone.now()
                recharge.reviewed_by = request.user
                recharge.save()
                recharge.user.balance += recharge.wallet_credit
                recharge.user.save(update_fields=['balance'])
                WalletTransaction.objects.create(
                    user=recharge.user, type='credit', amount=recharge.wallet_credit,
                    method=recharge.method,
                    note=recharge.wallet_credit_description(),
                )

    @admin.action(description='Reject selected recharge requests')
    def reject_selected(self, request, queryset):
        queryset.filter(status='pending').update(status='rejected', reviewed_at=timezone.now())


@admin.register(CryptoPayment)
class CryptoPaymentAdmin(admin.ModelAdmin):
    list_display    = ['id', 'recharge_request', 'currency', 'amount_dt', 'amount_crypto', 'status', 'expires_at', 'created_at']
    list_filter     = ['currency', 'status']
    search_fields   = ['recharge_request__user__username', 'tx_hash']
    readonly_fields = ['created_at', 'exchange_rate', 'wallet_address', 'amount_crypto', 'expires_at']


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display  = ['key', 'value', 'label']
    search_fields = ['key', 'label']


class GiftCardInline(admin.TabularInline):
    model         = GiftCard
    extra         = 0
    readonly_fields = ['code', 'redeemed_by', 'redeemed_at', 'created_at']
    can_delete    = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(GiftCardBatch)
class GiftCardBatchAdmin(admin.ModelAdmin):
    list_display    = ['id', 'label', 'amount', 'quantity', 'cards_used_count', 'expires_at', 'created_at']
    readonly_fields = ['created_by', 'created_at']
    inlines         = [GiftCardInline]

    def cards_used_count(self, obj):
        return obj.cards.filter(redeemed_by__isnull=False).count()
    cards_used_count.short_description = 'Used'

    def save_model(self, request, obj, form, change):
        import secrets
        is_new = obj.pk is None
        obj.created_by = request.user
        super().save_model(request, obj, form, change)
        if is_new:
            existing = set(GiftCard.objects.values_list('code', flat=True))
            cards = []
            for _ in range(obj.quantity):
                while True:
                    code = 'GMC-' + secrets.token_hex(6).upper()
                    if code not in existing:
                        existing.add(code)
                        break
                cards.append(GiftCard(batch=obj, code=code))
            GiftCard.objects.bulk_create(cards)

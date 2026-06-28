from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, WalletTransaction


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'balance', 'points', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('GMC Store', {'fields': ('role', 'balance', 'points', 'avatar', 'phone')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('GMC Store', {'fields': ('role', 'email', 'balance', 'points')}),
    )
    actions = ['add_balance_action', 'reset_points_action']

    @admin.action(description='Add 100 DT balance to selected users')
    def add_balance_action(self, request, queryset):
        for user in queryset:
            user.balance += 100
            user.save()

    @admin.action(description='Reset points to 0')
    def reset_points_action(self, request, queryset):
        queryset.update(points=0)


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'type', 'amount', 'method', 'created_at']
    list_filter = ['type', 'method', 'created_at']
    search_fields = ['user__username', 'note']
    readonly_fields = ['created_at']

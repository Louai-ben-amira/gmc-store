from django.contrib import admin
from .models import Order, OrderCredentials


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display   = ['id', 'user', 'product', 'amount_paid', 'points_earned', 'status', 'service_status', 'requires_account', 'created_at']
    list_filter    = ['status', 'service_status', 'requires_account', 'created_at']
    search_fields  = ['user__username', 'product__name']
    readonly_fields = ['created_at', 'amount_paid', 'points_earned', 'points_used']


@admin.register(OrderCredentials)
class OrderCredentialsAdmin(admin.ModelAdmin):
    list_display   = ['order', 'is_used', 'delivered_at', 'created_at']
    list_filter    = ['is_used']
    readonly_fields = ['order', 'data_encrypted', 'access_log', 'created_at']

    def has_add_permission(self, request):
        return False

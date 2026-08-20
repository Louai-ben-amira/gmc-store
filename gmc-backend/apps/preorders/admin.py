from django.contrib import admin

from .models import PreOrder


@admin.register(PreOrder)
class PreOrderAdmin(admin.ModelAdmin):
    list_display  = ('id', 'user', 'product', 'variant', 'status', 'queue_position',
                     'price_at_order', 'created_at', 'fulfilled_at')
    list_filter   = ('status', 'created_at')
    search_fields = ('user__username', 'user__email', 'product__name')
    raw_id_fields = ('user', 'product', 'variant', 'order')
    readonly_fields = ('created_at', 'cancelled_at', 'fulfilled_at')

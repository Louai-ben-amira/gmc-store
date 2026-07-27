from django.contrib import admin
from .models import OrderTicket, OrderTicketMessage, SupportTicket, SupportTicketMessage


@admin.register(OrderTicket)
class OrderTicketAdmin(admin.ModelAdmin):
    list_display  = ('id', 'order', 'user', 'subject', 'status', 'created_at')
    list_filter   = ('status',)
    search_fields = ('subject', 'user__username', 'order__id')


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display  = ('id', 'category', 'subject', 'user', 'status', 'created_at')
    list_filter   = ('category', 'status')
    search_fields = ('subject', 'user__username')


admin.site.register(OrderTicketMessage)
admin.site.register(SupportTicketMessage)

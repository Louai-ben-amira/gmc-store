from django.contrib import admin
from .models import Conversation, Message, CannedResponse


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display  = ['client', 'status', 'priority', 'unread_count', 'last_message_at']
    list_filter   = ['status', 'priority']
    search_fields = ['client__username']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ['conversation', 'sender', 'body_preview', 'status', 'created_at']
    list_filter   = ['status', 'created_at']
    search_fields = ['sender__username', 'body']

    def body_preview(self, obj):
        return obj.body[:50] if obj.body else '(attachment)'
    body_preview.short_description = 'Message'


@admin.register(CannedResponse)
class CannedResponseAdmin(admin.ModelAdmin):
    list_display  = ['shortcut', 'body', 'used_count']
    search_fields = ['shortcut', 'body']

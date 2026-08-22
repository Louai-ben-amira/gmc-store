from django.utils import timezone
from rest_framework import serializers

from .models import Notification

# "5 minutes ago" in both site languages. Index 0 is the singular/dual-safe
# short form Arabic uses for small counts; the plural form follows.
_AGO = {
    'en': {
        'now':    'just now',
        'minute': '{n}m ago',
        'hour':   '{n}h ago',
        'day':    '{n}d ago',
    },
    'ar': {
        'now':    'الآن',
        'minute': 'منذ {n} دقائق',
        'hour':   'منذ {n} ساعات',
        'day':    'منذ {n} أيام',
    },
}


def humanize_age(created_at, lang='en'):
    words = _AGO.get(lang) or _AGO['en']
    seconds = (timezone.now() - created_at).total_seconds()
    if seconds < 60:
        return words['now']
    minutes = int(seconds // 60)
    if minutes < 60:
        return words['minute'].format(n=minutes)
    hours = minutes // 60
    if hours < 24:
        return words['hour'].format(n=hours)
    days = hours // 24
    if days < 7:
        return words['day'].format(n=days)
    return timezone.localtime(created_at).strftime('%d/%m/%Y')


class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'body', 'link', 'is_read', 'created_at', 'time_ago']
        read_only_fields = fields

    def get_time_ago(self, obj):
        # Rendered in the reader's language, not the sender's.
        request = self.context.get('request')
        lang = 'en'
        if request and request.user.is_authenticated:
            lang = getattr(request.user, 'language_preference', 'en') or 'en'
        return humanize_age(obj.created_at, lang)


class BroadcastSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    body  = serializers.CharField(max_length=200)
    link  = serializers.CharField(max_length=200, required=False, allow_blank=True, default='/')

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Title cannot be empty.')
        return value

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message cannot be empty.')
        return value

    def validate_link(self, value):
        value = (value or '/').strip() or '/'
        # A notification click navigates inside the SPA - never off-site.
        if not value.startswith('/'):
            raise serializers.ValidationError('Link must be an internal path starting with "/".')
        return value


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    all = serializers.BooleanField(required=False, default=False)

    def validate(self, data):
        if not data.get('all') and not data.get('ids'):
            raise serializers.ValidationError('Provide either "ids" or "all": true.')
        return data

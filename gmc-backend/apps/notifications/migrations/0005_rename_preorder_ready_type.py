from django.db import migrations


def rename_forward(apps, schema_editor):
    """preorder_ready was renamed to preorder_fulfilled - carry existing rows over."""
    Notification = apps.get_model('notifications', 'Notification')
    Notification.objects.filter(type='preorder_ready').update(type='preorder_fulfilled')


def rename_backward(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    Notification.objects.filter(type='preorder_fulfilled').update(type='preorder_ready')


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_alter_notification_link_alter_notification_type_and_more'),
    ]

    operations = [
        migrations.RunPython(rename_forward, rename_backward),
    ]

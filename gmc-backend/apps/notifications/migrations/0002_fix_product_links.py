from django.db import migrations


def fix_product_links(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    qs = Notification.objects.filter(
        type__in=['flash_sale', 'wishlist_price_drop'],
        link__startswith='/products/',
    )
    for n in qs:
        n.link = '/product/' + n.link[len('/products/'):]
        n.save(update_fields=['link'])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(fix_product_links, reverse_noop),
    ]

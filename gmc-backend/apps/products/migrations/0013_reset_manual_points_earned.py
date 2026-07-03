from django.db import migrations


def reset_points_earned(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    ProductVariant = apps.get_model('products', 'ProductVariant')
    Product.objects.filter(points_earned__gt=0).update(points_earned=0)
    ProductVariant.objects.filter(points_earned__gt=0).update(points_earned=0)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0012_rename_accounts_to_topup'),
    ]

    operations = [
        migrations.RunPython(reset_points_earned, migrations.RunPython.noop),
    ]

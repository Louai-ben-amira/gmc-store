from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders',   '0006_credential_flow'),
        ('products', '0006_product_required_fields_has_variants_productvariant'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='variant',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='orders',
                to='products.productvariant',
            ),
        ),
    ]

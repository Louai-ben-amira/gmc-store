from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_product_requires_account_category_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='required_fields',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='product',
            name='has_variants',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='ProductVariant',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label',        models.CharField(max_length=100)),
                ('amount_value', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('price',        models.DecimalField(decimal_places=2, max_digits=10)),
                ('points_earned', models.IntegerField(default=0)),
                ('stock_count',  models.IntegerField(default=0)),
                ('is_active',    models.BooleanField(default=True)),
                ('order',        models.IntegerField(default=0)),
                ('product',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='variants', to='products.product')),
            ],
            options={
                'ordering': ['order', 'amount_value'],
            },
        ),
    ]

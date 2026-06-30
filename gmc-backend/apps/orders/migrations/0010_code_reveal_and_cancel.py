from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_product_set_null_on_delete'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='code_viewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='code_view_ip',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='OrderCodeViewLog',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='view_logs', to='orders.order')),
                ('viewed_at',  models.DateTimeField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-viewed_at'],
            },
        ),
    ]

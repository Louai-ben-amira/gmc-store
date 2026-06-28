from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0007_binance_only_crypto'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='rechargerequest',
            name='reference_code',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.CreateModel(
            name='GiftCardBatch',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label',      models.CharField(blank=True, max_length=200)),
                ('amount',     models.DecimalField(decimal_places=2, max_digits=10)),
                ('quantity',   models.IntegerField(default=1)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gift_card_batches', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at'], 'verbose_name': 'Gift Card Batch', 'verbose_name_plural': 'Gift Card Batches'},
        ),
        migrations.CreateModel(
            name='GiftCard',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code',        models.CharField(db_index=True, max_length=32, unique=True)),
                ('redeemed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('batch',       models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cards', to='payments.giftcardbatch')),
                ('redeemed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='redeemed_gift_cards', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['created_at']},
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0009_giftcardbatch_image'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='giftcardbatch',
            name='linked_product',
            field=models.OneToOneField(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='gift_card_batch',
                to='products.product',
            ),
        ),
    ]

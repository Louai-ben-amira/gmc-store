from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0008_rechargerequest_reference_code_giftcardbatch_giftcard'),
    ]

    operations = [
        migrations.AddField(
            model_name='giftcardbatch',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='gift_cards/'),
        ),
    ]

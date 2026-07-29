from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_user_email_resend_count_user_email_verified_at_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='user',
            old_name='email_verify_token',
            new_name='email_verify_code',
        ),
        migrations.AlterField(
            model_name='user',
            name='email_verify_code',
            field=models.CharField(blank=True, db_index=True, max_length=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='email_verify_attempts',
            field=models.IntegerField(default=0),
        ),
    ]

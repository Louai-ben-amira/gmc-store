from django.db import migrations, models


def clear_old_tokens(apps, schema_editor):
    """Old link-based verify tokens are longer than the new 6-char code field
    and are meaningless under the new scheme anyway — drop them before the
    column is shrunk, or Postgres rejects the ALTER with a truncation error."""
    User = apps.get_model('users', 'User')
    User.objects.exclude(email_verify_code__isnull=True).update(email_verify_code=None)


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
        migrations.RunPython(clear_old_tokens, migrations.RunPython.noop),
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

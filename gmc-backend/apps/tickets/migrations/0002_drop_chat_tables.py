# Drops the old messenger tables (apps.chat, removed from INSTALLED_APPS and
# deleted from the codebase, replaced by this app). Written here rather than
# in apps.chat's own migrations because an app no longer in INSTALLED_APPS is
# invisible to `makemigrations`/`migrate` — its migration files would never run.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS chat_message;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS chat_cannedresponse;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS chat_conversation;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

import random
import string
from decimal import Decimal
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _make_code():
    chars = string.ascii_uppercase + string.digits
    return 'GMC-' + ''.join(random.choices(chars, k=6))


def backfill_referral_codes(apps, schema_editor):
    User = apps.get_model('users', 'User')
    existing = set()
    for user in User.objects.filter(referral_code=''):
        code = _make_code()
        while code in existing or User.objects.filter(referral_code=code).exists():
            code = _make_code()
        existing.add(code)
        user.referral_code = code
        user.save(update_fields=['referral_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_wallettransaction_balance_after'),
    ]

    operations = [
        # Step 1: add field WITHOUT unique constraint so existing rows can all be ''
        migrations.AddField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, max_length=12, default=''),
            preserve_default=False,
        ),
        # Step 2: backfill unique codes for every existing user
        migrations.RunPython(backfill_referral_codes, migrations.RunPython.noop),
        # Step 3: now it's safe to add the unique + index constraint
        migrations.AlterField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, db_index=True, max_length=12, unique=True, default=''),
        ),
        migrations.AddField(
            model_name='user',
            name='referred_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='referrals',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='ReferralBonus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount',                     models.DecimalField(decimal_places=2, default=Decimal('2.00'), max_digits=10)),
                ('was_eligible',               models.BooleanField()),
                ('referrer_balance_at_signup', models.DecimalField(decimal_places=2, max_digits=10)),
                ('created_at',                 models.DateTimeField(auto_now_add=True)),
                ('referrer',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='referral_bonuses_earned', to=settings.AUTH_USER_MODEL)),
                ('referred_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='referral_bonus_source',   to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]

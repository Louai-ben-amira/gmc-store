"""
Data migration: seed SiteSettings rows for D17 and ticket payment configuration.
Uses get_or_create so re-running is safe and existing values are not overwritten.
"""
from django.db import migrations


DEFAULTS = [
    # D17 direct transfer
    ('D17_PHONE_NUMBER',   '24 027 209',          'D17 Phone Number'),
    ('D17_PHONE_ENABLED',  'true',                'D17 Phone Number Enabled'),
    ('D17_ADDRESS',        '',                    'D17 Account Address / RIB'),
    ('D17_ADDRESS_LABEL',  'D17 Account Address', 'D17 Address Label'),
    ('D17_ADDRESS_ENABLED','true',                'D17 Address Enabled'),
    # Ticket methods
    ('TICKET_TAX_RATE',    '0.11',
     'Commission rate deducted from ticket face value (0.11 = 11%)'),
    ('OOREDOO_INSTRUCTIONS',
     'Buy an Ooredoo recharge ticket, then enter the code and face value below. '
     'An 11% operator commission will be deducted automatically.',
     'Ooredoo Ticket Instructions'),
    ('ORANGE_INSTRUCTIONS',
     'Buy an Orange Tunisia recharge ticket, then enter the code and face value below. '
     'An 11% operator commission will be deducted automatically.',
     'Orange Ticket Instructions'),
]


def seed_settings(apps, schema_editor):
    SiteSettings = apps.get_model('payments', 'SiteSettings')
    for key, value, label in DEFAULTS:
        SiteSettings.objects.get_or_create(
            key=key,
            defaults={'value': value, 'label': label},
        )


def unseed_settings(apps, schema_editor):
    SiteSettings = apps.get_model('payments', 'SiteSettings')
    keys = [row[0] for row in DEFAULTS]
    SiteSettings.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0005_recharge_ticket_d17_fields'),
    ]

    operations = [
        migrations.RunPython(seed_settings, reverse_code=unseed_settings),
    ]

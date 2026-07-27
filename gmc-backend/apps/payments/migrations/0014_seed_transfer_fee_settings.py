"""
Data migration: seed SiteSettings rows for per-payment-method fee configuration
(D17 Phone, D17 Address, Bank Transfer, E-Dinar, Flouci), mirroring the existing
ticket tax rate so admins can edit every method's fee from Site Settings.
"""
from django.db import migrations


DEFAULTS = [
    ('D17_NUMBER_FEE_RATE', '0.01',
     'D17 Phone transfer fee rate (0.01 = 1%)'),
    ('D17_ADDRESS_FEE_RATE', '0',
     'D17 Address/RIB transfer fee rate (0 = no fee)'),
    ('BANK_TRANSFER_FLAT_FEE', '2.5',
     'Bank Transfer flat fee in DT'),
    ('EDINAR_FEE_RATE', '0',
     'E-Dinar transfer fee rate (0 = no fee)'),
    ('FLOUCI_FEE_RATE', '0',
     'Flouci transfer fee rate (0 = no fee)'),
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
        ('payments', '0013_backfill_recharge_ticket_items'),
    ]

    operations = [
        migrations.RunPython(seed_settings, reverse_code=unseed_settings),
    ]

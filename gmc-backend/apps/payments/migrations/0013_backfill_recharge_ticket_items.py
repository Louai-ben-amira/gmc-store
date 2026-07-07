from django.db import migrations


def backfill_ticket_items(apps, schema_editor):
    RechargeRequest = apps.get_model('payments', 'RechargeRequest')
    RechargeTicketItem = apps.get_model('payments', 'RechargeTicketItem')

    qs = RechargeRequest.objects.filter(
        method__in=['ooredoo_ticket', 'orange_ticket'],
    ).exclude(ticket_code='')

    for r in qs:
        RechargeTicketItem.objects.create(
            request=r,
            code=r.ticket_code,
            value=r.ticket_value or 0,
            credit=r.wallet_credit,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0012_recharge_ticket_items'),
    ]

    operations = [
        migrations.RunPython(backfill_ticket_items, noop_reverse),
    ]

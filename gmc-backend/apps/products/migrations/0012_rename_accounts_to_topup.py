from django.db import migrations

RENAMES = {
    'epic-games-accounts':  'Epic Games Top Up',
    'valorant-accounts':    'Valorant Top Up',
    'fortnite-accounts':    'Fortnite Top Up',
    'roblox-accounts':      'Roblox Top Up',
    'steam-accounts':       'Steam Top Up',
    'lol-accounts':         'League of Legends Top Up',
    'ea-fc-accounts':       'EA FC Top Up',
    'clash-of-clans-accounts': 'Clash of Clans Top Up',
    'genshin-accounts':     'Genshin Impact Top Up',
}


def rename_forward(apps, schema_editor):
    Category = apps.get_model('products', 'Category')
    for slug, name in RENAMES.items():
        Category.objects.filter(slug=slug).update(name=name)


def rename_backward(apps, schema_editor):
    Category = apps.get_model('products', 'Category')
    reverse_names = {
        'epic-games-accounts':  'Epic Games Accounts',
        'valorant-accounts':    'Valorant Accounts',
        'fortnite-accounts':    'Fortnite Accounts',
        'roblox-accounts':      'Roblox Accounts',
        'steam-accounts':       'Steam Accounts',
        'lol-accounts':         'League of Legends Accounts',
        'ea-fc-accounts':       'EA FC Accounts',
        'clash-of-clans-accounts': 'Clash of Clans Accounts',
        'genshin-accounts':     'Genshin Impact Accounts',
    }
    for slug, name in reverse_names.items():
        Category.objects.filter(slug=slug).update(name=name)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0011_product_slug'),
    ]

    operations = [
        migrations.RunPython(rename_forward, rename_backward),
    ]

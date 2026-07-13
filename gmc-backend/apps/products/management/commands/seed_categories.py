from django.core.management.base import BaseCommand
from apps.products.models import Category


CATEGORY_TREE = [
    {
        'name': 'Gaming', 'slug': 'gaming', 'icon': '🎮',
        'color': '#6C3EE8', 'order': 1,
        'children': [
            {
                'name': 'Gift Cards', 'slug': 'gift-cards', 'icon': '🎁',
                'color': '#8B5CF6', 'order': 1,
                'children': [
                    {
                        'name': 'Steam Gift Cards', 'slug': 'steam-gift-cards', 'icon': '🎮', 'order': 1,
                        'children': [
                            {'name': 'Global', 'slug': 'steam-global', 'icon': '🌍', 'order': 1},
                            {'name': 'Europe', 'slug': 'steam-europe', 'icon': '🇪🇺', 'order': 2},
                            {'name': 'Other',  'slug': 'steam-other',  'icon': '🎮', 'order': 3},
                        ],
                    },
                    {
                        'name': 'PlayStation Gift Cards', 'slug': 'playstation-gift-cards', 'icon': '🕹️', 'order': 2,
                        'children': [
                            {'name': 'USA',    'slug': 'psn-usa',    'icon': '🇺🇸', 'order': 1},
                            {'name': 'France', 'slug': 'psn-france', 'icon': '🇫🇷', 'order': 2},
                            {'name': 'Other',  'slug': 'psn-other',  'icon': '🕹️', 'order': 3},
                        ],
                    },
                    {
                        'name': 'Xbox Gift Cards', 'slug': 'xbox-gift-cards', 'icon': '🟢', 'order': 3,
                        'children': [
                            {'name': 'USA',    'slug': 'xbox-usa',    'icon': '🇺🇸', 'order': 1},
                            {'name': 'Turkey', 'slug': 'xbox-turkey', 'icon': '🇹🇷', 'order': 2},
                            {'name': 'Other',  'slug': 'xbox-other',  'icon': '🟢', 'order': 3},
                        ],
                    },
                    {'name': 'Nintendo eShop',          'slug': 'nintendo-eshop',         'icon': '🔴', 'order': 4},
                    {'name': 'Razer Gold',              'slug': 'razer-gold',             'icon': '💚', 'order': 5},
                    {'name': 'Roblox Gift Cards',       'slug': 'roblox-gift-cards',      'icon': '🟥', 'order': 6},
                    {'name': 'Riot Gift Cards',         'slug': 'riot-gift-cards',        'icon': '⚔️', 'order': 7},
                    {'name': 'Google Play',             'slug': 'google-play',            'icon': '▶️', 'order': 8},
                    {
                        'name': 'Apple Gift Cards', 'slug': 'apple-gift-cards', 'icon': '🍎', 'order': 9,
                        'children': [
                            {'name': 'USA',       'slug': 'itunes-usa',       'icon': '🇺🇸', 'order': 1},
                            {'name': 'France',    'slug': 'itunes-france',    'icon': '🇫🇷', 'order': 2},
                            {'name': 'Turkey',    'slug': 'itunes-turkey',    'icon': '🇹🇷', 'order': 3},
                            {'name': 'Allemagne', 'slug': 'itunes-allemagne', 'icon': '🇩🇪', 'order': 4},
                        ],
                    },
                ],
            },
            {
                'name': 'Game Top-Ups', 'slug': 'game-top-ups', 'icon': '⚡',
                'color': '#F59E0B', 'order': 2, 'requires_account': True,
                'children': [
                    {
                        'name': 'Valorant Points (VP)', 'slug': 'valorant-points', 'icon': '🔫', 'order': 1,
                        'children': [
                            {'name': 'Europe', 'slug': 'valorant-europe', 'icon': '🇪🇺', 'order': 1},
                            {'name': 'Turkey', 'slug': 'valorant-turkey', 'icon': '🇹🇷', 'order': 2},
                        ],
                    },
                    {'name': 'Fortnite V-Bucks',            'slug': 'fortnite-vbucks',         'icon': '🏗️', 'order': 2},
                    {'name': 'Roblox Robux',                'slug': 'roblox-robux',            'icon': '🟥', 'order': 3},
                    {'name': 'Free Fire Diamonds',          'slug': 'free-fire-diamonds',      'icon': '💎', 'order': 4},
                    {'name': 'PUBG UC',                     'slug': 'pubg-uc',                 'icon': '🎯', 'order': 5},
                    {'name': 'Blood Strike',                'slug': 'blood-strike',            'icon': '🩸', 'order': 6},
                    {'name': 'Mobile Legends Diamonds',     'slug': 'mobile-legends-diamonds', 'icon': '👑', 'order': 7},
                    {'name': 'Brawl Stars Gems',            'slug': 'brawl-stars-gems',        'icon': '💠', 'order': 8},
                    {'name': 'Clash of Clans Gems',         'slug': 'clash-of-clans-gems',     'icon': '⚔️', 'order': 9},
                    {'name': 'Clash Royale Gems',           'slug': 'clash-royale-gems',       'icon': '👑', 'order': 10},
                ],
            },
            {
                'name': 'Game Accounts', 'slug': 'game-accounts', 'icon': '👤',
                'color': '#EF4444', 'order': 3, 'requires_account': True,
                'children': [
                    {'name': 'Valorant Top Up',              'slug': 'valorant-accounts',          'icon': '🔫', 'order': 1},
                    {'name': 'Fortnite Top Up',              'slug': 'fortnite-accounts',          'icon': '🏗️', 'order': 2},
                    {'name': 'Roblox Top Up',                'slug': 'roblox-accounts',            'icon': '🟥', 'order': 3},
                    {'name': 'League of Legends Top Up',     'slug': 'lol-accounts',               'icon': '⚔️', 'order': 4},
                    {'name': 'EA FC Top Up',                 'slug': 'ea-fc-accounts',             'icon': '⚽', 'order': 5},
                    {'name': 'Rocket League Top Up',         'slug': 'rocket-league-accounts',     'icon': '🚀', 'order': 6},
                    {'name': 'Clash of Clans Top Up',        'slug': 'clash-of-clans-accounts',   'icon': '🏰', 'order': 7},
                    {'name': 'Genshin Impact Top Up',        'slug': 'genshin-accounts',           'icon': '🌸', 'order': 8},
                    {'name': 'Steam Top Up',                 'slug': 'steam-accounts',             'icon': '🎮', 'order': 9},
                    {'name': 'Epic Games Top Up',            'slug': 'epic-games-accounts',        'icon': '🖤', 'order': 10},
                ],
            },
            {
                'name': 'In-Game Currency', 'slug': 'in-game-currency', 'icon': '💰',
                'color': '#10B981', 'order': 4,
                'children': [
                    {'name': 'WoW Gold',                'slug': 'wow-gold',         'icon': '🟡', 'order': 1},
                    {'name': 'RuneScape Gold',          'slug': 'runescape-gold',   'icon': '🟡', 'order': 2},
                    {'name': 'FIFA Coins',              'slug': 'fifa-coins',        'icon': '⚽', 'order': 3},
                    {'name': 'GTA Money',               'slug': 'gta-money',         'icon': '💵', 'order': 4},
                    {'name': 'Lost Ark Gold',           'slug': 'lost-ark-gold',    'icon': '🏹', 'order': 5},
                    {'name': 'Path of Exile Currency',  'slug': 'poe-currency',     'icon': '💀', 'order': 6},
                ],
            },
            {
                'name': 'Game Keys', 'slug': 'game-keys', 'icon': '🔑',
                'color': '#3B82F6', 'order': 5,
                'children': [
                    {'name': 'Steam Keys',       'slug': 'steam-keys',       'icon': '🎮', 'order': 1},
                    {'name': 'Epic Games Keys',  'slug': 'epic-games-keys',  'icon': '🖤', 'order': 2},
                    {'name': 'EA App Keys',      'slug': 'ea-app-keys',      'icon': '🟠', 'order': 3},
                    {'name': 'Ubisoft Keys',     'slug': 'ubisoft-keys',     'icon': '🔷', 'order': 4},
                    {'name': 'Battle.net Keys',  'slug': 'battlenet-keys',   'icon': '💙', 'order': 5},
                    {'name': 'Xbox Keys',        'slug': 'xbox-keys',        'icon': '🟢', 'order': 6},
                    {'name': 'PlayStation Keys', 'slug': 'playstation-keys', 'icon': '🔵', 'order': 7},
                ],
            },
            {
                'name': 'PC Games', 'slug': 'pc-games', 'icon': '🖥️',
                'color': '#6366F1', 'order': 6,
                'children': [
                    {'name': 'Action',      'slug': 'pc-action',     'icon': '💥', 'order': 1},
                    {'name': 'RPG',         'slug': 'pc-rpg',        'icon': '⚔️', 'order': 2},
                    {'name': 'FPS',         'slug': 'pc-fps',        'icon': '🔫', 'order': 3},
                    {'name': 'Strategy',    'slug': 'pc-strategy',   'icon': '♟️', 'order': 4},
                    {'name': 'Simulation',  'slug': 'pc-simulation', 'icon': '🌍', 'order': 5},
                    {'name': 'Indie Games', 'slug': 'pc-indie',      'icon': '🎨', 'order': 6},
                ],
            },
            {
                'name': 'Console Games', 'slug': 'console-games', 'icon': '🕹️',
                'color': '#8B5CF6', 'order': 7,
                'children': [
                    {'name': 'PS4',           'slug': 'ps4-games',      'icon': '🔵', 'order': 1},
                    {'name': 'PS5',           'slug': 'ps5-games',      'icon': '⬜', 'order': 2},
                    {'name': 'Xbox One',      'slug': 'xbox-one-games', 'icon': '🟢', 'order': 3},
                    {'name': 'Xbox Series X/S', 'slug': 'xbox-series',  'icon': '🟢', 'order': 4},
                    {'name': 'Nintendo Switch', 'slug': 'switch-games', 'icon': '🔴', 'order': 5},
                ],
            },
            {
                'name': 'Skins & Cosmetics', 'slug': 'skins-cosmetics', 'icon': '✨',
                'color': '#EC4899', 'order': 8,
            },
            {
                'name': 'DLC & Battle Passes', 'slug': 'dlc-battle-passes', 'icon': '📦',
                'color': '#F97316', 'order': 9,
                'children': [
                    {'name': 'DLC Packs',       'slug': 'dlc-packs',       'icon': '📁', 'order': 1},
                    {'name': 'Season Passes',   'slug': 'season-passes',   'icon': '📅', 'order': 2},
                    {'name': 'Expansion Packs', 'slug': 'expansion-packs', 'icon': '🗺️', 'order': 3},
                    {'name': 'Battle Passes',   'slug': 'battle-passes',   'icon': '⚔️', 'order': 4},
                ],
            },
            {
                'name': 'Services', 'slug': 'gaming-services', 'icon': '🛠️',
                'color': '#64748B', 'order': 10,
                'children': [
                    {'name': 'Boosting',         'slug': 'boosting',         'icon': '🚀', 'order': 1},
                    {'name': 'Coaching',         'slug': 'coaching',         'icon': '🎓', 'order': 2},
                    {'name': 'Carry Services',   'slug': 'carry-services',   'icon': '🏆', 'order': 3},
                ],
            },
        ],
    },
    {
        'name': 'Digital Products', 'slug': 'digital-products', 'icon': '💻',
        'color': '#06B6D4', 'order': 2,
        'children': [
            {
                'name': 'Streaming & Entertainment', 'slug': 'streaming-entertainment', 'icon': '📺',
                'color': '#E11D48', 'order': 1,
                'children': [
                    {'name': 'Netflix',          'slug': 'netflix',          'icon': '🎬', 'order': 1},
                    {'name': 'Spotify Premium',  'slug': 'spotify-premium',  'icon': '🎵', 'order': 2},
                    {'name': 'Disney+',          'slug': 'disney-plus',      'icon': '🏰', 'order': 3},
                    {'name': 'YouTube Premium',  'slug': 'youtube-premium',  'icon': '▶️', 'order': 4},
                    {'name': 'Crunchyroll',      'slug': 'crunchyroll',      'icon': '🍥', 'order': 5},
                ],
            },
            {
                'name': 'AI & Productivity', 'slug': 'ai-productivity', 'icon': '🤖',
                'color': '#7C3AED', 'order': 2,
                'children': [
                    {'name': 'ChatGPT Plus',       'slug': 'chatgpt-plus',       'icon': '🤖', 'order': 1},
                    {'name': 'Claude Pro',         'slug': 'claude-pro',         'icon': '🧠', 'order': 2},
                    {'name': 'Canva Pro',          'slug': 'canva-pro',          'icon': '🎨', 'order': 3},
                    {'name': 'Grammarly Premium',  'slug': 'grammarly-premium',  'icon': '✍️', 'order': 4},
                    {'name': 'Notion Plus',        'slug': 'notion-plus',        'icon': '📝', 'order': 5},
                ],
            },
        ],
    },
    {
        'name': 'Mobile & Telecom', 'slug': 'mobile-telecom', 'icon': '📱',
        'color': '#059669', 'order': 3,
        'children': [
            {
                'name': 'Mobile Top-Up', 'slug': 'mobile-top-up', 'icon': '📶',
                'color': '#10B981', 'order': 1,
                'children': [
                    {'name': 'Ooredoo',                 'slug': 'ooredoo-top-up',      'icon': '🔴', 'order': 1},
                    {'name': 'Orange',                  'slug': 'orange-top-up',       'icon': '🟠', 'order': 2},
                    {'name': 'Tunisie Telecom',         'slug': 'tunisie-telecom-top-up', 'icon': '🔵', 'order': 3},
                    {'name': 'International Recharge',  'slug': 'international-recharge', 'icon': '🌍', 'order': 4},
                ],
            },
            {
                'name': 'eSIM & Data Plans', 'slug': 'esim-data-plans', 'icon': '📡',
                'color': '#0EA5E9', 'order': 2,
                'children': [
                    {'name': 'Travel eSIM',               'slug': 'travel-esim',             'icon': '✈️', 'order': 1},
                    {'name': 'International Data Packages','slug': 'international-data',      'icon': '🌐', 'order': 2},
                ],
            },
        ],
    },
]


created_count = 0
updated_count = 0


def create_category(data, parent=None):
    global created_count, updated_count
    children = data.get('children', [])
    cat, created = Category.objects.update_or_create(
        slug=data['slug'],
        defaults={
            'name':             data.get('name', ''),
            'parent':           parent,
            'icon':             data.get('icon', ''),
            'color':            data.get('color', parent.color if parent else ''),
            'order':            data.get('order', 0),
            'requires_account': data.get('requires_account', False),
            'is_active':        True,
        }
    )
    if created:
        created_count += 1
    else:
        updated_count += 1
    for child in children:
        create_category(child, parent=cat)
    return cat


class Command(BaseCommand):
    help = 'Seed the database with the full GMC Store category tree'

    def handle(self, *args, **options):
        global created_count, updated_count
        created_count = 0
        updated_count = 0
        for tree in CATEGORY_TREE:
            create_category(tree)

        total = Category.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Done - {total} categories in DB '
            f'({created_count} created, {updated_count} updated)'
        ))

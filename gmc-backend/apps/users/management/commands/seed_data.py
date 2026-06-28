from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal


PRODUCTS = [
    {'name': 'Valorant 1000 VP', 'category': 'valorant', 'price': Decimal('25.00'), 'stock': 50},
    {'name': 'Valorant 500 VP', 'category': 'valorant', 'price': Decimal('14.00'), 'stock': 60},
    {'name': 'Steam Wallet 50 USD', 'category': 'steam', 'price': Decimal('165.00'), 'stock': 18},
    {'name': 'Steam Wallet 20 USD', 'category': 'steam', 'price': Decimal('68.00'), 'stock': 0},
    {'name': 'Epic Games 25 USD', 'category': 'epic', 'price': Decimal('85.00'), 'stock': 11},
    {'name': 'Fortnite Battle Pass', 'category': 'battle_pass', 'price': Decimal('32.00'), 'stock': 25},
    {'name': 'Ooredoo 10 DT', 'category': 'ooredoo', 'price': Decimal('10.00'), 'stock': 999},
    {'name': 'Amazon Gift 25 USD', 'category': 'gift_cards', 'price': Decimal('88.00'), 'stock': 7},
    {'name': 'PlayStation 50 USD', 'category': 'gift_cards', 'price': Decimal('168.00'), 'stock': 4},
]


class Command(BaseCommand):
    help = 'Seed the database with sample data'

    def handle(self, *args, **options):
        from apps.users.models import User, WalletTransaction
        from apps.products.models import Product, Code
        from apps.orders.models import Order
        from apps.chat.models import Conversation, Message

        self.stdout.write('Seeding database...')

        with transaction.atomic():
            # Admin user
            admin, created = User.objects.get_or_create(
                username='admin',
                defaults={
                    'email': 'admin@gmc.store',
                    'role': 'admin',
                    'is_staff': True,
                    'is_superuser': True,
                    'first_name': 'Admin',
                    'last_name': 'GMC',
                }
            )
            if created or not admin.check_password('Admin1234!'):
                admin.set_password('Admin1234!')
                admin.save()
            self.stdout.write(f'  Admin user: admin@gmc.store / Admin1234!')

            # Client users
            clients = []
            client_data = [
                ('alice', 'alice@example.com', 'Alice', 'Martin', Decimal('150.00'), 800),
                ('bob', 'bob@example.com', 'Bob', 'Smith', Decimal('200.00'), 1500),
                ('carol', 'carol@example.com', 'Carol', 'Jones', Decimal('50.00'), 200),
                ('david', 'david@example.com', 'David', 'Brown', Decimal('120.00'), 600),
                ('emma', 'emma@example.com', 'Emma', 'Wilson', Decimal('80.00'), 350),
            ]
            for username, email, first, last, balance, points in client_data:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': email,
                        'first_name': first,
                        'last_name': last,
                        'role': 'client',
                        'balance': balance,
                        'points': points,
                    }
                )
                if created:
                    user.set_password('Client1234!')
                    user.save()
                clients.append(user)
            self.stdout.write(f'  Created {len(clients)} client users')

            # Products
            products = []
            for p_data in PRODUCTS:
                product, _ = Product.objects.get_or_create(
                    name=p_data['name'],
                    defaults={
                        'category': p_data['category'],
                        'price': p_data['price'],
                        'stock_count': p_data['stock'],
                        'visible': True,
                        'description': f'Buy {p_data["name"]} instantly and securely.',
                    }
                )
                products.append(product)
            self.stdout.write(f'  Created {len(products)} products')

            # Codes (3 per in-stock product)
            for product in products:
                if product.stock_count > 0:
                    for i in range(3):
                        Code.objects.get_or_create(
                            product=product,
                            code=f'GMC-{product.name[:3].upper()}-{product.id:03d}-{i+1:04d}',
                            defaults={'status': 'available'}
                        )
            self.stdout.write('  Created codes for in-stock products')

            # Orders for each client (3 per client)
            in_stock_products = [p for p in products if p.stock_count > 0]
            for client in clients:
                for i in range(min(3, len(in_stock_products))):
                    product = in_stock_products[i % len(in_stock_products)]
                    available_code = Code.objects.filter(product=product, status='available').first()
                    if not available_code:
                        available_code = Code.objects.create(
                            product=product,
                            code=f'GMC-SEED-{client.id}-{product.id}-{i}',
                            status='available'
                        )

                    order, created = Order.objects.get_or_create(
                        user=client,
                        product=product,
                        defaults={
                            'code': available_code,
                            'amount_paid': product.price,
                            'points_earned': int(product.price),
                            'status': 'completed',
                        }
                    )
                    if created:
                        available_code.status = 'sold'
                        available_code.order = order
                        available_code.save()
                        WalletTransaction.objects.create(
                            user=client,
                            type='debit',
                            amount=product.price,
                            method='wallet',
                            note=f'Purchase: {product.name}'
                        )

            self.stdout.write('  Created sample orders')

            # Conversations with messages
            sample_messages = [
                ('Hello! I need help with my order.', True),
                ('Of course! How can I assist you today?', False),
                ('I purchased a code but it seems invalid.', True),
            ]
            for client in clients:
                conv, _ = Conversation.objects.get_or_create(client=client)
                if not conv.messages.exists():
                    for body, is_client in sample_messages:
                        sender = client if is_client else admin
                        Message.objects.create(
                            conversation=conv,
                            sender=sender,
                            body=body,
                            is_read=True,
                        )
            self.stdout.write('  Created sample conversations')

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write('  Admin: admin@gmc.store / Admin1234!')
        self.stdout.write('  Clients: alice, bob, carol, david, emma / Client1234!')
        self.stdout.write('  Admin panel: http://localhost:8000/admin')

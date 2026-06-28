from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def check_low_stock():
    from apps.products.models import Product
    low_stock = Product.objects.filter(stock_count__lt=3, visible=True)
    if low_stock.exists():
        names = ', '.join(low_stock.values_list('name', flat=True))
        send_mail(
            'Low Stock Alert - GMC Store',
            f'The following products are low on stock (< 3 remaining):\n{names}',
            settings.DEFAULT_FROM_EMAIL,
            [settings.EMAIL_HOST_USER or 'admin@gmcstore.com'],
            fail_silently=True
        )


@shared_task
def expire_flash_sales():
    """Auto-deactivate flash sales whose end time has passed. Runs every minute via Celery Beat."""
    from django.utils import timezone
    from apps.products.models import Product

    expired_qs = Product.objects.filter(is_flash_sale=True, flash_sale_end__lt=timezone.now())
    names      = list(expired_qs.values_list('name', flat=True)[:5])
    count      = expired_qs.count()

    if count:
        expired_qs.update(is_flash_sale=False, flash_sale_price=None, flash_sale_end=None)
        try:
            from apps.payments.tasks import send_telegram_alert
            send_telegram_alert.delay(
                f"⏰ <b>Flash sale ended</b> ({count} product{'s' if count > 1 else ''})\n"
                + '\n'.join(f'• {n}' for n in names)
            )
        except Exception:
            pass

    return f'Expired {count} flash sale(s)'

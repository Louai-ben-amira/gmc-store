from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/wallet/', include('apps.users.wallet_urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/admin/', include('apps.users.admin_urls')),
    path('api/admin/tickets/', include('apps.tickets.admin_urls')),
]

# Serve uploaded media locally only when R2 is not the active backend.
# With R2, files live in the bucket and are served from its public/signed URLs.
if settings.DEBUG and not settings.USE_R2:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

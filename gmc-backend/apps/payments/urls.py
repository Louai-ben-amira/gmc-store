from django.urls import path
from . import views

urlpatterns = [
    # Client — recharge
    path('recharge/',              views.RechargeCreateView.as_view(), name='recharge_create'),
    path('recharge/preview/',      views.recharge_preview,             name='recharge_preview'),
    path('payment-methods/',       views.payment_methods,              name='payment_methods'),

    # Client — crypto
    path('crypto/',                views.initiate_crypto,              name='crypto_initiate'),
    path('crypto/mine/',           views.my_crypto_payments,           name='crypto_mine'),
    path('crypto/<int:pk>/qr/',    views.crypto_qr,                    name='crypto_qr'),
    path('crypto/<int:pk>/tx/',    views.submit_tx_hash,               name='crypto_tx'),

    # Admin — recharges (manual methods)
    path('admin/recharges/',                    views.admin_recharge_list,    name='admin_recharge_list'),
    path('admin/recharges/<int:pk>/approve/',   views.admin_recharge_approve, name='admin_recharge_approve'),
    path('admin/recharges/<int:pk>/reject/',    views.admin_recharge_reject,  name='admin_recharge_reject'),

    # Admin — crypto
    path('admin/crypto/',          views.admin_crypto_list,            name='admin_crypto_list'),
    path('admin/crypto/<int:pk>/', views.admin_crypto_action,          name='admin_crypto_action'),

    # Public
    path('hero-slides/',           views.public_hero_slides,               name='public_hero_slides'),

    # Admin — site settings
    path('settings/',              views.SiteSettingsListView.as_view(),   name='site_settings'),
    path('settings/<int:pk>/',     views.SiteSettingsDetailView.as_view(), name='site_settings_detail'),
    path('settings/upload-hero-image/', views.upload_hero_image,           name='upload_hero_image'),

    # Admin — gift card batches
    path('admin/gift-cards/',                        views.admin_gift_card_batches,         name='admin_gift_card_batches'),
    path('admin/gift-cards/<int:pk>/',               views.admin_gift_card_batch_detail,    name='admin_gift_card_batch_detail'),
    path('admin/gift-cards/<int:pk>/codes/',         views.admin_gift_card_batch_codes,     name='admin_gift_card_batch_codes'),
]

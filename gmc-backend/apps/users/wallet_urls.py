from django.urls import path
from . import views
from apps.payments.views import RechargeCreateView, redeem_gift_card

urlpatterns = [
    path('', views.WalletView.as_view(), name='wallet'),
    path('recharge/', RechargeCreateView.as_view(), name='wallet_recharge'),
    path('transactions/', views.WalletTransactionsView.as_view(), name='wallet_transactions'),
    path('referral/', views.referral_stats, name='referral_stats'),
    path('redeem/', redeem_gift_card, name='redeem_gift_card'),
]

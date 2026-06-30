from django.urls import path
from . import views

urlpatterns = [
    path('',                          views.OrderListCreateView.as_view(),  name='order_list_create'),
    path('<int:pk>/',                 views.OrderDetailView.as_view(),      name='order_detail'),
    path('<int:pk>/reorder/',         views.reorder,                        name='reorder'),
    path('<int:pk>/reveal-code/',     views.reveal_code,                    name='order_reveal_code'),
    path('<int:pk>/cancel/',          views.cancel_order,                   name='order_cancel'),
    path('<int:pk>/credentials/',     views.order_credentials,              name='order_credentials'),
    path('<int:pk>/service-status/',  views.update_service_status,          name='order_service_status'),
    path('<int:pk>/confirm/',         views.confirm_delivery,               name='order_confirm'),
    path('<int:pk>/dispute/',         views.open_dispute,                   name='order_dispute'),
    path('validate-promo/',           views.validate_promo,                 name='validate_promo'),
    path('promo-codes/',              views.AdminPromoCodeListView.as_view(), name='admin_promo_codes'),
    path('promo-codes/<int:pk>/',     views.AdminPromoCodeDetailView.as_view(), name='admin_promo_code_detail'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('users/',                      views.AdminUsersListView.as_view(),     name='admin_users'),
    path('users/<int:pk>/',             views.AdminUserDetailView.as_view(),    name='admin_user_detail'),
    path('recharges/',                  views.AdminRechargesListView.as_view(), name='admin_recharges'),
    path('recharges/<int:pk>/',         views.AdminRechargeApproveView.as_view(), name='admin_recharge_approve'),
    path('stats/',                      views.admin_stats,                      name='admin_stats'),
    path('badge-counts/',               views.admin_badge_counts,               name='admin_badge_counts'),
    path('analytics/',                  views.admin_analytics,                  name='admin_analytics'),
    path('orders/',                     views.admin_orders,                     name='admin_orders'),
    path('orders/seen/',                views.admin_orders_seen,                name='admin_orders_seen'),
    path('orders/<int:pk>/cancel/',     views.admin_cancel_order,               name='admin_cancel_order'),
    path('conversations/',              views.admin_conversations,              name='admin_conversations'),
]

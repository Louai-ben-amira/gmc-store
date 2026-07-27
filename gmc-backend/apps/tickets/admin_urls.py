from django.urls import path
from . import views

urlpatterns = [
    path('order/',   views.admin_order_tickets,   name='admin_order_tickets'),
    path('support/', views.admin_support_tickets, name='admin_support_tickets'),
    path('create/',  views.admin_create_ticket,   name='admin_create_ticket'),
]

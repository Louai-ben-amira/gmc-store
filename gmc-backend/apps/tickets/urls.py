from django.urls import path
from . import views

urlpatterns = [
    path('order/',                    views.OrderTicketListCreateView.as_view(),  name='order_ticket_list_create'),
    path('order/<int:pk>/',           views.OrderTicketDetailView.as_view(),      name='order_ticket_detail'),
    path('order/<int:pk>/messages/',  views.order_ticket_send_message,            name='order_ticket_send_message'),
    path('order/<int:pk>/status/',    views.order_ticket_set_status,              name='order_ticket_set_status'),

    path('support/',                   views.SupportTicketListCreateView.as_view(), name='support_ticket_list_create'),
    path('support/<int:pk>/',          views.SupportTicketDetailView.as_view(),     name='support_ticket_detail'),
    path('support/<int:pk>/messages/', views.support_ticket_send_message,           name='support_ticket_send_message'),
    path('support/<int:pk>/status/',   views.support_ticket_set_status,             name='support_ticket_set_status'),
]

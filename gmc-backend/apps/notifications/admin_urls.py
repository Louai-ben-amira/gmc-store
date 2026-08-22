from django.urls import path
from . import views

urlpatterns = [
    path('broadcast/',          views.broadcast,          name='notification_broadcast'),
    path('broadcast/audience/', views.broadcast_audience, name='notification_broadcast_audience'),
]

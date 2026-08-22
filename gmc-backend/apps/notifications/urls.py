from django.urls import path
from . import views

urlpatterns = [
    path('',               views.notification_feed,     name='notification_feed'),
    path('unread-count/',  views.unread_count,          name='notification_unread_count'),
    path('mark-read/',     views.mark_read,             name='notification_mark_read'),
    path('read-all/',      views.mark_all_read,         name='notification_mark_all_read'),
    path('<int:pk>/read/', views.mark_one_read,         name='notification_mark_one_read'),
    path('<int:pk>/',      views.delete_notification,   name='notification_delete'),
]

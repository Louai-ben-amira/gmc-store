from django.urls import path
from . import views

urlpatterns = [
    path('',                  views.NotificationListView.as_view(), name='notification_list'),
    path('unread-count/',     views.unread_count,                   name='notification_unread_count'),
    path('<int:pk>/read/',    views.mark_read,                      name='notification_mark_read'),
    path('read-all/',         views.mark_all_read,                  name='notification_mark_all_read'),
]

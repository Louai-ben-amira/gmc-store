from django.urls import path
from . import views

urlpatterns = [
    path('conversation/',            views.ConversationView.as_view(),           name='conversation'),
    path('messages/',                views.MessageListCreateView.as_view(),       name='messages'),
    path('messages/read/',           views.mark_messages_read,                    name='messages_read'),
    path('canned/',                  views.CannedResponseListCreateView.as_view(), name='canned_list'),
    path('canned/<int:pk>/',         views.CannedResponseDetailView.as_view(),    name='canned_detail'),
    path('canned/<int:pk>/use/',     views.use_canned_response,                   name='canned_use'),
    path('context/<int:user_id>/',   views.user_context,                          name='user_context'),
]

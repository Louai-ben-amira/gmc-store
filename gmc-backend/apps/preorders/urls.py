from django.urls import path
from . import views

urlpatterns = [
    path('',                  views.preorder_list_create, name='preorder_list_create'),
    path('<int:pk>/cancel/',  views.cancel_preorder,      name='preorder_cancel'),
]

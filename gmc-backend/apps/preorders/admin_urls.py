from django.urls import path
from . import views

urlpatterns = [
    path('',                            views.admin_preorder_list,      name='admin_preorder_list'),
    path('products/',                   views.admin_preorder_products,  name='admin_preorder_products'),
    path('by-product/<int:product_id>/', views.admin_preorder_queue,    name='admin_preorder_queue'),
    path('<int:pk>/deliver/',           views.admin_deliver_preorder,   name='admin_preorder_deliver'),
    path('<int:pk>/skip/',              views.admin_skip_preorder,      name='admin_preorder_skip'),
    path('<int:pk>/requeue/',           views.admin_requeue_preorder,   name='admin_preorder_requeue'),
    path('auto-fulfill/<int:product_id>/', views.admin_auto_fulfill,    name='admin_preorder_auto_fulfill'),
]

from django.urls import path
from . import views

urlpatterns = [
    # Categories
    path('categories/',                views.CategoryListView.as_view(),     name='category_list'),
    path('categories/<slug:slug>/',    views.CategoryDetailView.as_view(),   name='category_detail'),
    path('categories/<slug:slug>/products/', views.category_products,        name='category_products'),
    # Products
    path('',                           views.ProductListView.as_view(),      name='product_list'),
    path('recommendations/',           views.recommendations,                name='recommendations'),
    path('best-sellers/',              views.best_sellers,                   name='best_sellers'),
    path('wishlist/',                  views.wishlist_list,                  name='wishlist_list'),
    path('<int:pk>/',                  views.ProductDetailView.as_view(),    name='product_detail'),
    path('<slug:slug>/',               views.ProductDetailView.as_view(),    name='product_detail_slug'),
    path('<int:pk>/codes/',            views.bulk_upload_codes,              name='bulk_upload_codes'),
    path('<int:pk>/codes/<int:code_id>/', views.delete_code,                name='delete_code'),
    path('<int:pk>/sync-stock/',       views.sync_stock,                     name='sync_stock'),
    path('<int:pk>/variants/',         views.product_variants,               name='product_variants'),
    path('<int:pk>/variants/<int:variant_id>/', views.product_variant_detail, name='product_variant_detail'),
    path('<int:pk>/reviews/',          views.ReviewListView.as_view(),       name='product_reviews'),
    path('<int:pk>/reviews/submit/',   views.submit_review,                  name='submit_review'),
    path('<int:pk>/reviews/eligibility/', views.review_eligibility,         name='review_eligibility'),
    path('<int:pk>/wishlist/',         views.wishlist_toggle,                name='wishlist_toggle'),
    # Bundles
    path('bundles/',                   views.BundleListView.as_view(),       name='bundle_list'),
    path('bundles/<int:pk>/',          views.BundleDetailView.as_view(),     name='bundle_detail'),
]

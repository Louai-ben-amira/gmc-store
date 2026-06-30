from django.contrib import admin
from .models import Category, Product, Code, Bundle, Review, Wishlist, ProductVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display   = ['name', 'slug', 'parent', 'icon', 'color', 'is_active', 'order', 'requires_account']
    list_filter    = ['is_active', 'requires_account', 'parent']
    search_fields  = ['name', 'slug']
    list_editable  = ['is_active', 'order', 'requires_account']
    prepopulated_fields = {'slug': ('name',)}
    ordering       = ['order', 'name']


class ProductVariantInline(admin.TabularInline):
    model          = ProductVariant
    extra          = 0
    fields         = ['label', 'amount_value', 'price', 'points_earned', 'stock_count', 'is_active', 'order']
    ordering       = ['order', 'amount_value']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display   = ['name', 'category', 'price', 'stock_count', 'visible', 'requires_account', 'has_variants', 'created_at']
    list_filter    = ['category', 'visible', 'requires_account', 'has_variants', 'created_at']
    search_fields  = ['name', 'description']
    list_editable  = ['visible', 'price', 'stock_count', 'requires_account', 'has_variants']
    autocomplete_fields = ['category']
    inlines        = [ProductVariantInline]
    actions        = ['toggle_visible']

    fieldsets = (
        (None, {'fields': (
            'name', 'category', 'description', 'image', 'price', 'stock_count', 'visible',
            'requires_account', 'required_fields', 'has_variants',
        )}),
        ('Flash Sale', {'fields': ('is_flash_sale', 'flash_sale_price', 'flash_sale_end'), 'classes': ('collapse',)}),
    )

    @admin.action(description='Toggle visibility')
    def toggle_visible(self, request, queryset):
        for product in queryset:
            product.visible = not product.visible
            product.save()


@admin.register(Code)
class CodeAdmin(admin.ModelAdmin):
    list_display    = ['product', 'platform', 'code', 'status', 'created_at']
    list_filter     = ['status', 'platform', 'product']
    list_editable   = ['platform']
    search_fields   = ['code', 'product__name']
    readonly_fields = ['created_at']


@admin.register(Bundle)
class BundleAdmin(admin.ModelAdmin):
    list_display  = ['name', 'bundle_price', 'is_active', 'created_at']
    list_editable = ['is_active']
    filter_horizontal = ['products']


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ['product', 'user', 'rating', 'created_at']
    list_filter   = ['rating']
    readonly_fields = ['created_at']

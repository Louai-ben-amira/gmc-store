from rest_framework import serializers
from django.db.models import Avg
from .models import Category, Product, Code, Bundle, Review, Wishlist, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = [
            'id', 'name', 'slug', 'parent', 'icon', 'image', 'color',
            'description', 'is_active', 'order', 'requires_account',
            'children', 'created_at',
        ]

    def get_children(self, obj):
        if not obj.children.exists():
            return []
        request = self.context.get('request')
        is_admin = (
            request and request.user.is_authenticated and
            getattr(request.user, 'role', '') == 'admin'
        )
        qs = obj.children.all() if is_admin else obj.children.filter(is_active=True)
        return CategorySerializer(
            qs.order_by('order', 'name'),
            many=True,
            context=self.context,
        ).data


class CategoryBreadcrumbSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'slug', 'icon', 'color']


class CodeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Code
        fields = ['id', 'code', 'platform', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class ReviewSerializer(serializers.ModelSerializer):
    username          = serializers.CharField(source='user.username', read_only=True)
    verified_purchase = serializers.SerializerMethodField()

    class Meta:
        model  = Review
        fields = ['id', 'username', 'rating', 'body', 'verified_purchase', 'created_at']
        read_only_fields = ['id', 'username', 'verified_purchase', 'created_at']

    def get_verified_purchase(self, obj):
        return obj.order_id is not None

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductVariant
        fields = ['id', 'label', 'amount_value', 'price', 'points_earned', 'stock_count', 'is_active', 'order']


class ProductSerializer(serializers.ModelSerializer):
    available_stock   = serializers.SerializerMethodField()
    effective_price   = serializers.SerializerMethodField()
    flash_sale_active = serializers.SerializerMethodField()
    avg_rating        = serializers.SerializerMethodField()
    review_count      = serializers.SerializerMethodField()
    is_wishlisted     = serializers.SerializerMethodField()
    category_detail   = CategoryBreadcrumbSerializer(source='category', read_only=True)
    variants          = ProductVariantSerializer(many=True, read_only=True)
    min_price         = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'category', 'category_detail', 'price', 'description', 'image',
            'stock_count', 'visible', 'available_stock', 'points_earned', 'created_at',
            'is_flash_sale', 'flash_sale_price', 'flash_sale_end',
            'effective_price', 'flash_sale_active',
            'avg_rating', 'review_count', 'is_wishlisted',
            'requires_account', 'required_fields', 'has_variants',
            'variants', 'min_price', 'points_purchasable',
        ]

    def get_available_stock(self, obj):
        return obj.stock_count

    def get_effective_price(self, obj):
        return str(obj.effective_price)

    def get_flash_sale_active(self, obj):
        return obj.flash_sale_active

    def get_avg_rating(self, obj):
        result = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(result, 1) if result else None

    def get_review_count(self, obj):
        return obj.reviews.count()

    def get_is_wishlisted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        wishlist_ids = self.context.get('wishlist_ids')
        if wishlist_ids is not None:
            return obj.id in wishlist_ids
        return Wishlist.objects.filter(user=request.user, product=obj).exists()

    def get_min_price(self, obj):
        if obj.has_variants:
            p = obj.min_variant_price()
            return str(p) if p is not None else None
        return None

    def validate_required_fields(self, value):
        import json
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (ValueError, TypeError):
                raise serializers.ValidationError('required_fields must be a valid JSON array.')
        if not isinstance(value, list):
            raise serializers.ValidationError('required_fields must be a list.')
        return value


class BundleProductSerializer(serializers.ModelSerializer):
    category_detail = CategoryBreadcrumbSerializer(source='category', read_only=True)

    class Meta:
        model  = Product
        fields = ['id', 'name', 'category', 'category_detail', 'image', 'price']


class BundleSerializer(serializers.ModelSerializer):
    products_detail     = BundleProductSerializer(source='products', many=True, read_only=True)
    products            = serializers.PrimaryKeyRelatedField(many=True, queryset=Product.objects.all())
    discount_percentage = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Bundle
        fields = [
            'id', 'name', 'description', 'image', 'products', 'products_detail',
            'bundle_price', 'original_price', 'discount_percentage', 'is_active', 'created_at',
        ]


class BulkCodeUploadSerializer(serializers.Serializer):
    codes    = serializers.ListField(child=serializers.CharField(), required=False)
    csv_text = serializers.CharField(required=False)
    platform = serializers.ChoiceField(
        choices=[c[0] for c in Code.PLATFORM_CHOICES],
        default='other',
        required=False,
    )

    def validate(self, data):
        if not data.get('codes') and not data.get('csv_text'):
            raise serializers.ValidationError('Provide either codes array or csv_text.')
        return data

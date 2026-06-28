from rest_framework import generics, status, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Category, Product, Code, Bundle, Review, Wishlist, ProductVariant
from .serializers import (
    CategorySerializer, ProductSerializer, CodeSerializer,
    BulkCodeUploadSerializer, BundleSerializer, ReviewSerializer,
    ProductVariantSerializer,
)
from apps.users.permissions import IsAdmin


# ── Categories ─────────────────────────────────────────────────────────────

class CategoryListView(generics.ListCreateAPIView):
    serializer_class   = CategorySerializer
    pagination_class   = None  # categories are small; return plain list

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        is_admin = user.is_authenticated and getattr(user, 'role', '') == 'admin'
        qs = Category.objects.all() if is_admin else Category.objects.filter(is_active=True)
        parent = self.request.query_params.get('parent')
        if parent == 'null' or parent == 'root':
            qs = qs.filter(parent__isnull=True)
        elif parent:
            qs = qs.filter(parent__slug=parent)
        return qs.prefetch_related('children')


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    lookup_field     = 'slug'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        return Category.objects.prefetch_related('children')


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def category_products(request, slug):
    """Products belonging to a category and all its descendants."""
    try:
        category = Category.objects.get(slug=slug, is_active=True)
    except Category.DoesNotExist:
        return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Collect IDs of this category and all descendants
    def collect_ids(cat):
        ids = [cat.id]
        for child in cat.children.filter(is_active=True):
            ids.extend(collect_ids(child))
        return ids

    cat_ids  = collect_ids(category)
    qs       = Product.objects.filter(visible=True, category_id__in=cat_ids)

    in_stock = request.query_params.get('in_stock')
    if in_stock == 'true':
        qs = qs.filter(stock_count__gt=0)

    wishlist_ids = set()
    if request.user.is_authenticated:
        wishlist_ids = set(
            Wishlist.objects.filter(user=request.user).values_list('product_id', flat=True)
        )

    ctx = {'request': request, 'wishlist_ids': wishlist_ids}
    return Response({
        'category':    CategorySerializer(category, context=ctx).data,
        'breadcrumbs': [
            {'id': a.id, 'name': a.name, 'slug': a.slug}
            for a in category.get_ancestors()
        ] + [{'id': category.id, 'name': category.name, 'slug': category.slug}],
        'products':    ProductSerializer(qs, many=True, context=ctx).data,
    })


# ── Products ────────────────────────────────────────────────────────────────

class ProductListView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    filter_backends  = [filters.SearchFilter]
    search_fields    = ['name', 'description']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user     = self.request.user
        is_admin = user.is_authenticated and getattr(user, 'role', '') == 'admin'
        qs       = Product.objects.select_related('category').prefetch_related('variants')
        if not is_admin:
            qs = qs.filter(visible=True)
        category = self.request.query_params.get('category')
        in_stock = self.request.query_params.get('in_stock')
        flash    = self.request.query_params.get('flash_sale')
        req_acc  = self.request.query_params.get('requires_account')

        if category and category != 'all':
            # Support filtering by slug (new) or id
            if category.isdigit():
                qs = qs.filter(category_id=int(category))
            else:
                try:
                    cat = Category.objects.get(slug=category)
                    def collect_ids(c):
                        ids = [c.id]
                        for ch in c.children.filter(is_active=True):
                            ids.extend(collect_ids(ch))
                        return ids
                    qs = qs.filter(category_id__in=collect_ids(cat))
                except Category.DoesNotExist:
                    qs = qs.none()

        if in_stock == 'true':
            qs = qs.filter(stock_count__gt=0)
        if flash == 'true':
            from django.utils import timezone
            qs = qs.filter(is_flash_sale=True, flash_sale_end__gt=timezone.now())
        if req_acc == 'true':
            qs = qs.filter(requires_account=True)

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated:
            ctx['wishlist_ids'] = set(
                Wishlist.objects.filter(user=self.request.user).values_list('product_id', flat=True)
            )
        return ctx


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Product.objects.select_related('category')
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdmin()]


@api_view(['POST'])
@permission_classes([IsAdmin])
def bulk_upload_codes(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = BulkCodeUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    codes_list = serializer.validated_data.get('codes', [])
    csv_text   = serializer.validated_data.get('csv_text', '')
    if csv_text:
        codes_list += [c.strip() for c in csv_text.split('\n') if c.strip()]

    created = []
    for code_val in codes_list:
        code = Code.objects.create(product=product, code=code_val)
        created.append(code)

    product.stock_count += len(created)
    product.save()

    return Response({
        'created': len(created),
        'codes': CodeSerializer(created, many=True).data
    }, status=status.HTTP_201_CREATED)


# ── Product Variants (admin) ────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin])
def product_variants(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        variants = product.variants.all().order_by('order', 'amount_value')
        return Response(ProductVariantSerializer(variants, many=True).data)

    serializer = ProductVariantSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(product=product)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdmin])
def product_variant_detail(request, pk, variant_id):
    try:
        variant = ProductVariant.objects.get(pk=variant_id, product_id=pk)
    except ProductVariant.DoesNotExist:
        return Response({'detail': 'Variant not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        variant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ProductVariantSerializer(variant, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


class BundleListView(generics.ListCreateAPIView):
    serializer_class = BundleSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        if self.request.method == 'GET' and not (
            hasattr(self.request, 'user') and
            self.request.user.is_authenticated and
            getattr(self.request.user, 'role', '') == 'admin'
        ):
            return Bundle.objects.filter(is_active=True)
        return Bundle.objects.all()


class BundleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Bundle.objects.all()
    serializer_class = BundleSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdmin()]


# ── Reviews ─────────────────────────────────────────────────────────────────

class ReviewListView(generics.ListAPIView):
    serializer_class   = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Review.objects.filter(product_id=self.kwargs['pk']).select_related('user', 'order')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_review(request, pk):
    try:
        product = Product.objects.get(pk=pk, visible=True)
    except Product.DoesNotExist:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    if Review.objects.filter(product=product, user=request.user).exists():
        return Response({'detail': 'You have already reviewed this product.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.orders.models import Order
    order = Order.objects.filter(
        user=request.user, product=product, status='completed'
    ).first()

    serializer = ReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(product=product, user=request.user, order=order)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def review_eligibility(request, pk):
    from apps.orders.models import Order
    has_order    = Order.objects.filter(user=request.user, product_id=pk, status='completed').exists()
    has_reviewed = Review.objects.filter(user=request.user, product_id=pk).exists()
    return Response({'can_review': has_order and not has_reviewed, 'has_reviewed': has_reviewed})


# ── Wishlist ─────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def wishlist_toggle(request, pk):
    try:
        product = Product.objects.get(pk=pk, visible=True)
    except Product.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    item, created = Wishlist.objects.get_or_create(user=request.user, product=product)
    if not created:
        item.delete()
        return Response({'wishlisted': False})
    return Response({'wishlisted': True})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wishlist_list(request):
    ids      = set(Wishlist.objects.filter(user=request.user).values_list('product_id', flat=True))
    products = Product.objects.filter(id__in=ids, visible=True).select_related('category')
    ctx      = {'request': request, 'wishlist_ids': ids}
    return Response(ProductSerializer(products, many=True, context=ctx).data)


# ── Recommendations ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recommendations(request):
    from apps.orders.models import Order
    from django.db.models import Count

    purchased_ids = set(
        Order.objects.filter(user=request.user, status='completed', product__isnull=False)
        .values_list('product_id', flat=True)
    )

    top_cats = (
        Order.objects.filter(user=request.user, status='completed', product__isnull=False)
        .values('product__category_id')
        .annotate(n=Count('id'))
        .order_by('-n')[:3]
    )
    cat_ids = [c['product__category_id'] for c in top_cats if c['product__category_id']]

    wishlist_ids = set(
        Wishlist.objects.filter(user=request.user).values_list('product_id', flat=True)
    )

    if cat_ids:
        qs = Product.objects.filter(
            visible=True, stock_count__gt=0, category_id__in=cat_ids
        ).exclude(id__in=purchased_ids)
    else:
        qs = Product.objects.filter(visible=True, stock_count__gt=0).exclude(id__in=purchased_ids)

    products = qs.select_related('category')[:8]
    ctx      = {'request': request, 'wishlist_ids': wishlist_ids}
    return Response(ProductSerializer(products, many=True, context=ctx).data)


# ── Best Sellers ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def best_sellers(request):
    """Top 10 products by completed order count."""
    from apps.orders.models import Order
    from django.db.models import Count

    top_ids = (
        Order.objects.filter(status='completed', product__isnull=False)
        .values('product_id')
        .annotate(sold=Count('id'))
        .order_by('-sold')
        .values_list('product_id', flat=True)[:10]
    )

    # Preserve order
    products = list(Product.objects.filter(id__in=top_ids, visible=True).select_related('category'))
    id_order = list(top_ids)
    products.sort(key=lambda p: id_order.index(p.id) if p.id in id_order else 999)

    wishlist_ids = set()
    if request.user.is_authenticated:
        wishlist_ids = set(Wishlist.objects.filter(user=request.user).values_list('product_id', flat=True))

    ctx = {'request': request, 'wishlist_ids': wishlist_ids}
    return Response(ProductSerializer(products, many=True, context=ctx).data)

from django.db import models
from django.db.models import Avg, Count, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.text import slugify


class ProductQuerySet(models.QuerySet):
    def with_card_data(self):
        """
        Annotate the per-card aggregates the ProductSerializer needs
        (avg rating, review count, code count) and prefetch variants, so a
        product list serializes in a constant number of queries instead of
        ~5 per product. Each aggregate is its own correlated subquery -
        combining them in a single .annotate() would multiply the JOINs and
        return inflated counts.
        """
        reviews = (
            Review.objects.filter(product=OuterRef('pk')).order_by().values('product')
        )
        codes = (
            Code.objects.filter(product=OuterRef('pk')).order_by().values('product')
        )
        return self.annotate(
            _avg_rating=Subquery(reviews.annotate(a=Avg('rating')).values('a')[:1]),
            _review_count=Coalesce(
                Subquery(reviews.annotate(c=Count('id')).values('c')[:1]), 0
            ),
            _code_count=Coalesce(
                Subquery(codes.annotate(c=Count('id')).values('c')[:1]), 0
            ),
        ).prefetch_related('variants')


class Category(models.Model):
    name             = models.CharField(max_length=100)
    slug             = models.SlugField(unique=True)
    parent           = models.ForeignKey(
                           'self', null=True, blank=True,
                           on_delete=models.CASCADE, related_name='children'
                       )
    icon             = models.CharField(max_length=10, blank=True)
    image            = models.ImageField(upload_to='categories/', null=True, blank=True)
    color            = models.CharField(max_length=7, blank=True)
    description      = models.TextField(blank=True)
    is_active        = models.BooleanField(default=True)
    order            = models.IntegerField(default=0)
    requires_account = models.BooleanField(default=False)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering         = ['order', 'name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)
            slug = base
            n = 1
            while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_ancestors(self):
        ancestors = []
        node = self.parent
        while node:
            ancestors.insert(0, node)
            node = node.parent
        return ancestors


class Product(models.Model):
    name             = models.CharField(max_length=200)
    category         = models.ForeignKey(
                           Category, null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='products'
                       )
    price            = models.DecimalField(max_digits=10, decimal_places=2)
    description      = models.TextField(blank=True)
    image            = models.ImageField(upload_to='products/', null=True, blank=True)
    stock_count      = models.IntegerField(default=0)
    visible          = models.BooleanField(default=True)
    requires_account = models.BooleanField(default=False)
    # Ordered list of input field definitions shown before checkout
    # Each entry: {key, label, type, required, placeholder}
    required_fields  = models.JSONField(default=list, blank=True)
    # When True, buyers choose from ProductVariant options instead of a fixed price
    has_variants     = models.BooleanField(default=False)
    created_at       = models.DateTimeField(auto_now_add=True)
    # Points redemption - only products where admin enables this can be bought with points
    points_purchasable = models.BooleanField(default=False)
    # How many loyalty points the buyer earns per purchase (0 = use global POINTS_RATE)
    points_earned      = models.IntegerField(default=0)
    # Flash sale
    is_flash_sale    = models.BooleanField(default=False)
    flash_sale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    flash_sale_end   = models.DateTimeField(null=True, blank=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def effective_price(self):
        if self.flash_sale_active:
            return self.flash_sale_price
        return self.price

    @property
    def flash_sale_active(self):
        return (
            self.is_flash_sale and
            self.flash_sale_price is not None and
            self.flash_sale_end is not None and
            timezone.now() < self.flash_sale_end
        )

    def min_variant_price(self):
        active = self.variants.filter(is_active=True)
        if not active.exists():
            return None
        return active.order_by('price').values_list('price', flat=True).first()


class ProductVariant(models.Model):
    product       = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    label         = models.CharField(max_length=100)
    amount_value  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    price         = models.DecimalField(max_digits=10, decimal_places=2)
    points_earned = models.IntegerField(default=0)
    stock_count   = models.IntegerField(default=0)
    is_active     = models.BooleanField(default=True)
    order         = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'amount_value']

    def __str__(self):
        return f"{self.product.name} - {self.label}"


class Bundle(models.Model):
    name           = models.CharField(max_length=200)
    description    = models.TextField(blank=True)
    image          = models.ImageField(upload_to='bundles/', null=True, blank=True)
    products       = models.ManyToManyField(Product, related_name='bundles')
    bundle_price   = models.DecimalField(max_digits=10, decimal_places=2)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def discount_percentage(self):
        if self.original_price > 0:
            return int((1 - float(self.bundle_price) / float(self.original_price)) * 100)
        return 0


class Review(models.Model):
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user       = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='reviews')
    order      = models.ForeignKey('orders.Order', null=True, blank=True, on_delete=models.SET_NULL, related_name='review')
    rating     = models.PositiveSmallIntegerField()
    body       = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering      = ['-created_at']
        unique_together = [('product', 'user')]

    def __str__(self):
        return f"{self.user.username} → {self.product.name} ({self.rating}★)"


class Wishlist(models.Model):
    user       = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='wishlist')
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='wishlisted_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'product')]

    def __str__(self):
        return f"{self.user.username} → {self.product.name}"


class Code(models.Model):
    STATUS_CHOICES = [('available', 'Available'), ('sold', 'Sold')]
    PLATFORM_CHOICES = [
        ('steam',     'Steam'),
        ('epic',      'Epic Games'),
        ('gog',       'GOG'),
        ('xbox',      'Xbox'),
        ('psn',       'PlayStation'),
        ('battlenet', 'Battle.net'),
        ('ubisoft',   'Ubisoft Connect'),
        ('ea',        'EA App'),
        ('other',     'Other'),
    ]
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='codes')
    code       = models.CharField(max_length=500)
    platform   = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='other', blank=True)
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='available')
    order      = models.ForeignKey('orders.Order', null=True, blank=True, on_delete=models.SET_NULL, related_name='codes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} - {self.code[:20]}"

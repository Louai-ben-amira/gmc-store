from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.products.models import Product, ProductVariant, Code
from apps.users.permissions import IsAdmin, require_verified_email

from . import services
from .models import PreOrder
from .serializers import (
    AdminPreOrderSerializer, DeliverPreOrderSerializer,
    PlacePreOrderSerializer, PreOrderSerializer,
)


def _preorder_qs():
    return PreOrder.objects.select_related('user', 'product', 'variant', 'order')


# ══════════════════════════════════════════════════════════════════════════
#  CLIENT
# ══════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def preorder_list_create(request):
    """GET: the client's own pre-orders.  POST: place a new one."""
    if request.method == 'GET':
        qs = _preorder_qs().filter(user=request.user).order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(PreOrderSerializer(qs, many=True, context={'request': request}).data)

    # ── Place a pre-order ──────────────────────────────────────────────────
    require_verified_email(request.user)

    serializer = PlacePreOrderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    product_id = serializer.validated_data['product_id']
    variant_id = serializer.validated_data.get('variant_id')

    try:
        product = Product.objects.get(pk=product_id, visible=True)
    except Product.DoesNotExist:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not product.allows_preorder:
        return Response(
            {'detail': 'Pre-orders are not enabled for this product.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Services / account products are delivered by hand against credentials -
    # the pre-order queue only covers code-based stock.
    has_phone_field = any(
        f.get('type') == 'tel' or f.get('key') == 'phone'
        for f in (product.required_fields or [])
    )
    if product.requires_account or has_phone_field or (
        product.category and product.category.requires_account
    ):
        return Response(
            {'detail': 'This product is delivered as a service and cannot be pre-ordered.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Resolve the variant (required when the product has any)
    variant = None
    if product.has_variants:
        if not variant_id:
            return Response(
                {'detail': 'Please select a variant to pre-order.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            variant = ProductVariant.objects.get(pk=variant_id, product=product, is_active=True)
        except ProductVariant.DoesNotExist:
            return Response(
                {'detail': 'Selected variant not found or inactive.'},
                status=status.HTTP_404_NOT_FOUND,
            )
    elif variant_id:
        return Response(
            {'detail': 'This product has no variants.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # In stock => there is nothing to wait for, buy it normally.
    in_stock = variant.stock_count > 0 if variant is not None else product.stock_count > 0
    if in_stock:
        return Response(
            {
                'detail': 'This product is in stock — please buy it normally.',
                'error':  'in_stock',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if PreOrder.objects.filter(
        user=request.user, product=product, variant=variant, status='pending'
    ).exists():
        return Response(
            {
                'detail': 'You already have a pending pre-order for this product.',
                'error':  'duplicate',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    price, fee = services.quote(product, variant)

    try:
        with transaction.atomic():
            # Lock the PRODUCT row, not the queue: two clients hitting
            # "Pre-Order" at the same moment must not be handed the same
            # position. Locking an existing row is also the only form
            # PostgreSQL allows here - FOR UPDATE is illegal on an aggregate,
            # so counting under select_for_update() would be a hard error.
            Product.objects.select_for_update().get(pk=product.pk)
            position = PreOrder.objects.filter(
                product=product, status='pending'
            ).count() + 1
            preorder = PreOrder.objects.create(
                user=request.user,
                product=product,
                variant=variant,
                price_at_order=price,
                service_fee_at_order=fee,
                status='pending',
                queue_position=position,
            )
    except IntegrityError:
        # Lost a race against the client's own duplicate submit - the partial
        # unique constraint caught it, so answer like the check above would.
        return Response(
            {
                'detail': 'You already have a pending pre-order for this product.',
                'error':  'duplicate',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    services._safe(lambda: services.notify_placed(preorder))

    data = PreOrderSerializer(preorder, context={'request': request}).data
    data['message'] = (
        f"You're #{preorder.queue_position} in queue. No payment taken yet — "
        f'you\'ll be charged only when your code is ready.'
    )
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_preorder(request, pk):
    """Client cancels their own pre-order, free, inside the 24h window."""
    try:
        preorder = _preorder_qs().get(pk=pk, user=request.user)
    except PreOrder.DoesNotExist:
        return Response({'detail': 'Pre-order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if preorder.status != 'pending':
        return Response(
            {'detail': f'This pre-order is already {preorder.get_status_display().lower()}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not preorder.can_cancel:
        return Response(
            {
                'detail': 'Cancellation window has passed. Please open a support '
                          'ticket to request cancellation.',
                'error':  'window_closed',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # No refund to make - no money was ever taken.
    with transaction.atomic():
        preorder.status       = 'cancelled'
        preorder.cancelled_at = timezone.now()
        preorder.save(update_fields=['status', 'cancelled_at'])
        services.recalculate_queue(preorder.product)

    services._safe(lambda: services.notify_cancelled(preorder))

    return Response(PreOrderSerializer(preorder, context={'request': request}).data)


# ══════════════════════════════════════════════════════════════════════════
#  ADMIN
# ══════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_preorder_list(request):
    """All pre-orders, newest first, filterable by product and status."""
    qs = _preorder_qs().order_by('-created_at')

    product_id = request.query_params.get('product_id')
    if product_id:
        qs = qs.filter(product_id=product_id)
    status_filter = request.query_params.get('status')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)
    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(user__username__icontains=search)

    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 20
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(
        AdminPreOrderSerializer(page, many=True, context={'request': request}).data
    )


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_preorder_products(request):
    """
    Products that have at least one pre-order, for the admin page's product
    picker: [{id, name, pending, total}].
    """
    from django.db.models import Count, Q

    # Annotate first, then filter on the annotation. Filtering on the relation
    # up front would join preorders twice and inflate the counts.
    products = (
        Product.objects.annotate(
            pending_count=Count('preorders', filter=Q(preorders__status='pending')),
            total_count=Count('preorders'),
        )
        .filter(total_count__gt=0)
        .order_by('-pending_count', 'name')
    )
    return Response([
        {
            'id':             p.id,
            'name':           p.name,
            'pending':        p.pending_count,
            'total':          p.total_count,
            'stock_count':    p.stock_count,
            'allows_preorder': p.allows_preorder,
        }
        for p in products
    ])


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_preorder_queue(request, product_id):
    """The full queue for one product, in delivery order."""
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Pending first (in queue order), then the skipped ones the admin still
    # needs to see, then the closed history.
    pending = _preorder_qs().filter(product=product, status='pending').order_by('created_at')
    others  = _preorder_qs().filter(product=product).exclude(status='pending').order_by('-created_at')

    ctx = {'request': request}
    return Response({
        'product': {
            'id':              product.id,
            'name':            product.name,
            'stock_count':     product.stock_count,
            'allows_preorder': product.allows_preorder,
            'preorder_note':   product.preorder_note,
            'has_variants':    product.has_variants,
            'available_codes': product.codes.filter(status='available').count(),
        },
        'queue':   AdminPreOrderSerializer(pending, many=True, context=ctx).data,
        'history': AdminPreOrderSerializer(others,  many=True, context=ctx).data,
    })


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_deliver_preorder(request, pk):
    """
    Manual delivery: the admin supplies a code, and the client is charged and
    handed it in one atomic action.
    """
    serializer = DeliverPreOrderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    code_value = serializer.validated_data['code']

    try:
        preorder = _preorder_qs().get(pk=pk)
    except PreOrder.DoesNotExist:
        return Response({'detail': 'Pre-order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if preorder.status not in ('pending', 'expired'):
        return Response(
            {'detail': f'This pre-order is already {preorder.get_status_display().lower()}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with transaction.atomic():
            code = Code.objects.create(
                product=preorder.product,
                code=code_value,
                status='sold',
            )
            order = services.fulfill_preorder(preorder, code=code, consume_stock=False)
    except services.InsufficientBalance as exc:
        return Response(
            {
                'error':     'insufficient_balance',
                'detail':    f'Client has insufficient balance — {exc.needed} DT needed, '
                             f'{exc.available} DT available.',
                'needed':    str(exc.needed),
                'available': str(exc.available),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        'detail':   'Pre-order delivered.',
        'order_id': order.id,
        'preorder': AdminPreOrderSerializer(preorder, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_skip_preorder(request, pk):
    """
    Take a pre-order out of the live queue.

    Body: {"status": "expired" | "failed"} — 'expired' (default) flags the
    client as skipped for a short balance and keeps the row visible so they
    can be re-queued after topping up; 'failed' drops them for good.
    """
    try:
        preorder = _preorder_qs().get(pk=pk)
    except PreOrder.DoesNotExist:
        return Response({'detail': 'Pre-order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if preorder.status != 'pending':
        return Response(
            {'detail': 'Only a pending pre-order can be skipped.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    new_status = request.data.get('status', 'expired')
    if new_status not in ('expired', 'failed'):
        return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        services.mark_skipped(
            preorder,
            needed=preorder.total_at_order,
            available=preorder.user.balance,
            status=new_status,
        )

    return Response(AdminPreOrderSerializer(preorder, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_requeue_preorder(request, pk):
    """
    Put a skipped ('expired') pre-order back at the end of the pending queue -
    the usual next step once the client has topped up their wallet.
    """
    try:
        preorder = _preorder_qs().get(pk=pk)
    except PreOrder.DoesNotExist:
        return Response({'detail': 'Pre-order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if preorder.status not in ('expired', 'failed'):
        return Response(
            {'detail': 'Only a skipped pre-order can be re-queued.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        preorder.status         = 'pending'
        preorder.failure_reason = ''
        preorder.queue_position = services.pending_count(preorder.product) + 1
        preorder.save(update_fields=['status', 'failure_reason', 'queue_position'])
        services.recalculate_queue(preorder.product)

    preorder.refresh_from_db()
    return Response(AdminPreOrderSerializer(preorder, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_auto_fulfill(request, product_id):
    """
    Auto-delivery: walk the product's queue oldest-first and deliver from
    available stock until it runs out. Clients whose balance is short are
    skipped (flagged 'expired') and the run continues down the queue.
    """
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    results, counts = services.auto_fulfill_product(product)
    services._safe(lambda: services.recalculate_queue(product))

    return Response({
        'fulfilled': counts['fulfilled'],
        'skipped':   counts['skipped'],
        'no_stock':  counts['no_stock'],
        'details':   results,
    })

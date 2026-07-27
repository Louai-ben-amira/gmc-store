from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.db.models import Count, Q
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import User, WalletTransaction
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer,
    ChangePasswordSerializer, WalletTransactionSerializer, AdminUserSerializer
)
from .permissions import IsAdmin
from apps.payments.models import RechargeRequest
from apps.payments.serializers import RechargeRequestSerializer
from config.throttles import LoginRateThrottle, RegisterRateThrottle, PasswordResetRateThrottle
from django.db import transaction
import requests as http_requests
import re


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def social_auth(request):
    """
    Verify a Google id_token or Facebook access_token, then find-or-create the user.
    Body: { provider: 'google'|'facebook', token: '...' }
    """
    provider = request.data.get('provider', '').lower()
    token    = request.data.get('token', '').strip()

    if not provider or not token:
        return Response({'detail': 'provider and token are required.'}, status=400)

    # ── Fetch user info from the provider ────────────────────────────────
    if provider == 'google':
        # Verify id_token via Google's tokeninfo endpoint
        r = http_requests.get(
            'https://oauth2.googleapis.com/tokeninfo',
            params={'id_token': token},
            timeout=10,
        )
        if r.status_code != 200:
            return Response({'detail': 'Invalid Google token.'}, status=400)
        info = r.json()
        if not settings.GOOGLE_CLIENT_ID:
            return Response({'detail': 'Google sign-in is not configured.'}, status=503)
        if info.get('aud') != settings.GOOGLE_CLIENT_ID:
            return Response({'detail': 'Token audience mismatch.'}, status=400)
        if str(info.get('email_verified')).lower() != 'true':
            return Response({'detail': 'Google email is not verified.'}, status=400)
        social_id  = info.get('sub')
        email      = info.get('email', '')
        first_name = info.get('given_name', '')
        last_name  = info.get('family_name', '')

    elif provider == 'facebook':
        r = http_requests.get(
            'https://graph.facebook.com/me',
            params={'fields': 'id,name,email,first_name,last_name', 'access_token': token},
            timeout=10,
        )
        if r.status_code != 200:
            return Response({'detail': 'Invalid Facebook token.'}, status=400)
        info = r.json()
        if 'error' in info:
            return Response({'detail': info['error'].get('message', 'Facebook error.')}, status=400)
        social_id  = info.get('id')
        email      = info.get('email', '')
        first_name = info.get('first_name', '')
        last_name  = info.get('last_name', '')

    else:
        return Response({'detail': 'Unsupported provider.'}, status=400)

    if not social_id:
        return Response({'detail': 'Could not retrieve user ID from provider.'}, status=400)

    # ── Find or create user ───────────────────────────────────────────────
    with transaction.atomic():
        user = None
        if email:
            user = User.objects.filter(email=email).first()
        if not user:
            # Generate a unique username from the social id
            base = re.sub(r'[^a-zA-Z0-9_]', '', (first_name or 'user').lower()) or 'user'
            username = base
            counter  = 1
            while User.objects.filter(username=username).exists():
                username = f'{base}{counter}'; counter += 1
            user = User.objects.create_user(
                username=username, email=email,
                first_name=first_name, last_name=last_name,
                password=None,  # unusable password - social-only account
            )
        else:
            # Update name if still blank
            changed = False
            if first_name and not user.first_name:
                user.first_name = first_name; changed = True
            if last_name  and not user.last_name:
                user.last_name  = last_name;  changed = True
            if changed:
                user.save(update_fields=['first_name', 'last_name'])

    tokens = get_tokens_for_user(user)
    return Response({
        'user': UserSerializer(user, context={'request': request}).data,
        **tokens,
    })


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Token is invalid or already blacklisted.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # New accounts start unverified and get a verification email right away.
        # Existing users are untouched - see migration 0008 which grandfathers
        # them in with is_email_verified=True.
        from .models import generate_verify_token
        from .tasks import send_verification_email

        token = generate_verify_token()
        user.is_email_verified   = False
        user.email_verify_token  = token
        user.email_verify_sent_at = timezone.now()
        user.save(update_fields=['is_email_verified', 'email_verify_token', 'email_verify_sent_at'])

        send_verification_email.delay(
            user.id, user.email, user.get_full_name() or user.username, token
        )

        # Tokens are still issued so the user is logged in immediately - the
        # frontend reads is_email_verified off the user payload to decide
        # whether to show the "check your inbox" state.
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **tokens
        }, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **tokens
        })


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_theme(request):
    theme = request.data.get('theme')
    if theme not in ('dark', 'light'):
        return Response({'detail': 'Invalid theme. Use "dark" or "light".'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.theme_preference = theme
    request.user.save(update_fields=['theme_preference'])
    return Response({'theme': theme})


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_language(request):
    language = request.data.get('language')
    if language not in ('en', 'ar'):
        return Response({'detail': 'Invalid language. Use "en" or "ar".'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.language_preference = language
    request.user.save(update_fields=['language_preference'])
    return Response({'language': language})


class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email).first()
        if user:
            from django.utils.http import urlsafe_base64_encode
            from django.utils.encoding import force_bytes
            from django.contrib.auth.tokens import default_token_generator
            from .tasks import send_password_reset_email

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_password_reset_email.delay(user.id, uid, token)

        # Same response whether or not the email exists - avoids leaking which emails are registered.
        return Response({'detail': 'If an account exists for this email, a reset link has been sent.'})


class ResetPasswordView(generics.GenericAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password has been reset successfully.'})


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'detail': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email_verify_token=token, is_email_verified=False).first()
        if not user:
            return Response({'detail': 'Invalid or already used token.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.email_verify_sent_at or timezone.now() - user.email_verify_sent_at > timedelta(hours=24):
            return Response({'detail': 'Link expired - request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_email_verified = True
        user.email_verify_token = None
        user.email_verified_at = timezone.now()
        user.save(update_fields=['is_email_verified', 'email_verify_token', 'email_verified_at'])

        return Response({'message': 'Email verified successfully'})


class ResendVerificationView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import generate_verify_token
        from .tasks import send_verification_email

        user = request.user
        if user.is_email_verified:
            return Response({'detail': 'Already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        if user.email_resend_count >= 3:
            return Response({
                'error': 'max_resends_reached',
                'message': 'Maximum resend attempts reached. Contact support.',
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        token = generate_verify_token()
        user.email_verify_token = token
        user.email_verify_sent_at = timezone.now()
        user.email_resend_count += 1
        user.save(update_fields=['email_verify_token', 'email_verify_sent_at', 'email_resend_count'])

        send_verification_email.delay(
            user.id, user.email, user.get_full_name() or user.username, token
        )

        return Response({
            'message': 'Verification email sent',
            'resends_remaining': 3 - user.email_resend_count,
        })


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password changed successfully.'})


# Wallet views
class WalletView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        transactions = WalletTransaction.objects.filter(user=user)[:10]
        return Response({
            'balance': user.balance,
            'points': user.points,
            'transactions': WalletTransactionSerializer(transactions, many=True).data,
        })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def referral_stats(request):
    from .models import ReferralBonus
    user = request.user
    bonuses = ReferralBonus.objects.filter(referrer=user).select_related('referred_user').order_by('-created_at')

    # One pass over the evaluated queryset for the history rows...
    bonus_list = list(bonuses)
    history = [
        {
            'username': b.referred_user.get_full_name() or b.referred_user.username,
            'date':     b.created_at.isoformat(),
            'status':   'credited' if b.was_eligible else 'pending',
            'amount':   str(b.amount),
        }
        for b in bonus_list
    ]
    # ...and a single aggregate query for the totals/counts.
    total_count = len(bonus_list)
    pending_count = sum(1 for b in bonus_list if not b.was_eligible)
    total_earned = sum((b.amount for b in bonus_list if b.was_eligible), 0)

    return Response({
        'referral_code':   user.referral_code,
        'referrals_count': total_count,
        'pending_count':   pending_count,
        'total_earned':    str(total_earned),
        'history':         history,
    })


class WalletTransactionsView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WalletTransaction.objects.filter(user=self.request.user)


# Admin views
class AdminUsersListView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = (
            User.objects
            .select_related('referred_by')
            .annotate(orders_count=Count('orders'))
            .order_by('-created_at')
        )
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(referral_code__icontains=search)
            )
        verified = self.request.query_params.get('verified')
        if verified is not None:
            qs = qs.filter(is_email_verified=verified.lower() in ('1', 'true', 'yes'))
        return qs


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        from django.db.models import Count
        return User.objects.annotate(orders_count=Count('orders'))

    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        balance = request.data.get('balance')
        is_active = request.data.get('is_active')
        verify_email = request.data.get('verify_email')
        reset_resend_count = request.data.get('reset_resend_count')
        if balance is not None:
            user.balance = balance
            user.save()
        if is_active is not None:
            user.is_active = is_active
            user.save()
        if verify_email:
            # Manual override for clients with a genuine email delivery problem.
            user.is_email_verified = True
            user.email_verify_token = None
            user.email_verified_at = timezone.now()
            user.save(update_fields=['is_email_verified', 'email_verify_token', 'email_verified_at'])
        if reset_resend_count:
            # Un-does the 3-resend soft-block so the client can request 3 more.
            user.email_resend_count = 0
            user.save(update_fields=['email_resend_count'])
        return Response(AdminUserSerializer(user, context={'request': request}).data)


class AdminRechargesListView(generics.ListAPIView):
    serializer_class = RechargeRequestSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = RechargeRequest.objects.all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminRechargeApproveView(generics.GenericAPIView):
    permission_classes = [IsAdmin]
    serializer_class = RechargeRequestSerializer

    def patch(self, request, pk):
        try:
            recharge = RechargeRequest.objects.get(pk=pk)
        except RechargeRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if recharge.status != 'pending':
            return Response({'detail': f'Recharge is already {recharge.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        admin_note = serializer.validated_data.get('admin_note', '')

        from django.utils import timezone as tz
        with transaction.atomic():
            recharge.status      = new_status
            recharge.admin_note  = admin_note
            recharge.reviewed_by = request.user
            recharge.reviewed_at = tz.now()
            recharge.save()
            if new_status == 'approved':
                from apps.users.models import WalletTransaction
                recharge.user.balance += recharge.wallet_credit
                recharge.user.save(update_fields=['balance'])
                WalletTransaction.objects.create(
                    user          = recharge.user,
                    type          = 'credit',
                    amount        = recharge.wallet_credit,
                    balance_after = recharge.user.balance,
                    method        = recharge.method,
                    note          = recharge.wallet_credit_description(),
                )

        if new_status == 'approved':
            try:
                from apps.payments.tasks import send_recharge_approved_email
                send_recharge_approved_email.delay(recharge.id)
            except Exception:
                pass

        return Response(RechargeRequestSerializer(recharge).data)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_analytics(request):
    from django.db.models import Sum, Count, Avg, Q
    from django.db.models.functions import ExtractHour, TruncDate
    from django.utils import timezone
    from django.core.cache import cache
    from datetime import timedelta
    from apps.orders.models import Order

    # Dashboard data does not need to be real-time; serve a cached snapshot.
    CACHE_KEY = 'admin_analytics_v2'
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return Response(cached)

    now          = timezone.now()
    today_start  = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday    = today_start - timedelta(days=1)
    week_ago     = today_start - timedelta(days=7)
    month_start  = today_start.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    completed = Order.objects.filter(status='completed')

    # ── Revenue periods (single pass via conditional aggregation) ──────────
    def rev_between(start, end=None):
        cond = Q(created_at__gte=start)
        if end is not None:
            cond &= Q(created_at__lt=end)
        return Sum('amount_paid', filter=cond)

    agg = completed.aggregate(
        today=rev_between(today_start),
        yesterday=rev_between(yesterday, today_start),
        this_week=rev_between(week_ago),
        last_week=rev_between(week_ago - timedelta(days=7), week_ago),
        this_month=rev_between(month_start),
        last_month=rev_between(last_month_start, month_start),
        orders_today=Count('id', filter=Q(created_at__gte=today_start)),
    )
    revenue = {
        'today':        float(agg['today'] or 0),
        'yesterday':    float(agg['yesterday'] or 0),
        'this_week':    float(agg['this_week'] or 0),
        'last_week':    float(agg['last_week'] or 0),
        'this_month':   float(agg['this_month'] or 0),
        'last_month':   float(agg['last_month'] or 0),
        'orders_today': agg['orders_today'],
    }

    # ── Revenue by category (single grouped query) ─────────────────────────
    by_category = [
        {'category': r['product__category__name'], 'code': r['product__category__slug'],
         'revenue': float(r['revenue'] or 0), 'orders': r['orders']}
        for r in (
            completed
            .filter(product__category__is_active=True)
            .values('product__category__name', 'product__category__slug')
            .annotate(revenue=Sum('amount_paid'), orders=Count('id'))
            .filter(revenue__gt=0)
            .order_by('-revenue')
        )
    ]

    # ── Peak hours (last 30 days) ──────────────────────────────────────────
    peak_qs = (
        completed
        .filter(created_at__gte=now - timedelta(days=30))
        .annotate(hour=ExtractHour('created_at'))
        .values('hour')
        .annotate(count=Count('id'))
    )
    peak_map  = {row['hour']: row['count'] for row in peak_qs}
    peak_hours = [{'hour': h, 'orders': peak_map.get(h, 0)} for h in range(24)]

    # ── Best sellers ───────────────────────────────────────────────────────
    best_sellers = [
        {'product': r['product__name'], 'units': r['units'], 'revenue': float(r['revenue'] or 0)}
        for r in (
            completed
            .filter(product__isnull=False)
            .values('product__name')
            .annotate(units=Count('id'), revenue=Sum('amount_paid'))
            .order_by('-revenue')[:8]
        )
    ]

    # ── Top clients by lifetime value ──────────────────────────────────────
    top_clients = [
        {'username': r['user__username'], 'email': r['user__email'],
         'total_spent': float(r['total_spent'] or 0), 'orders': r['orders']}
        for r in (
            completed
            .values('user__username', 'user__email')
            .annotate(total_spent=Sum('amount_paid'), orders=Count('id'))
            .order_by('-total_spent')[:8]
        )
    ]

    # ── Daily revenue + orders (last 30 days, zero-filled) ─────────────────
    thirty_days_ago = today_start - timedelta(days=29)
    daily_qs = (
        completed
        .filter(created_at__gte=thirty_days_ago)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(revenue=Sum('amount_paid'), orders=Count('id'))
    )
    daily_map = {r['day'].isoformat(): r for r in daily_qs}
    daily_revenue = []
    for i in range(30):
        d = (thirty_days_ago + timedelta(days=i)).date().isoformat()
        row = daily_map.get(d)
        daily_revenue.append({
            'date':    d,
            'revenue': float(row['revenue'] or 0) if row else 0.0,
            'orders':  row['orders'] if row else 0,
        })

    # ── Recharge & wallet analytics (last 30 days) ─────────────────────────
    recent_recharges = RechargeRequest.objects.filter(created_at__gte=thirty_days_ago)
    recharge_by_method = [
        {'method': r['method'], 'count': r['count'], 'credited': float(r['credited'] or 0)}
        for r in (
            recent_recharges
            .filter(status='approved')
            .values('method')
            .annotate(count=Count('id'), credited=Sum('wallet_credit'))
            .order_by('-credited')
        )
    ]
    recharge_status = {
        r['status']: r['count']
        for r in recent_recharges.values('status').annotate(count=Count('id'))
    }
    credited_this_month = float(
        RechargeRequest.objects
        .filter(status='approved', created_at__gte=month_start)
        .aggregate(total=Sum('wallet_credit'))['total'] or 0
    )
    recharges = {
        'by_method':           recharge_by_method,
        'status_counts':       recharge_status,
        'credited_this_month': credited_this_month,
    }

    # ── User growth ────────────────────────────────────────────────────────
    signup_qs = (
        User.objects
        .filter(date_joined__gte=thirty_days_ago)
        .annotate(day=TruncDate('date_joined'))
        .values('day')
        .annotate(count=Count('id'))
    )
    signup_map = {r['day'].isoformat(): r['count'] for r in signup_qs}
    daily_signups = []
    for i in range(30):
        d = (thirty_days_ago + timedelta(days=i)).date().isoformat()
        daily_signups.append({'date': d, 'count': signup_map.get(d, 0)})
    users_growth = {
        'total':          User.objects.count(),
        'new_this_month': User.objects.filter(date_joined__gte=month_start).count(),
        'buyers':         completed.values('user').distinct().count(),
        'daily_signups':  daily_signups,
    }

    # ── Orders insights (last 30 days, all statuses) ───────────────────────
    recent_orders = Order.objects.filter(created_at__gte=thirty_days_ago)
    order_status_counts = {
        r['status']: r['count']
        for r in recent_orders.values('status').annotate(count=Count('id'))
    }
    aov = float(
        completed
        .filter(created_at__gte=thirty_days_ago)
        .aggregate(avg=Avg('amount_paid'))['avg'] or 0
    )
    orders_insights = {
        'aov':           round(aov, 2),
        'total':         recent_orders.count(),
        'status_counts': order_status_counts,
    }

    payload = {
        'revenue':         revenue,
        'by_category':     by_category,
        'peak_hours':      peak_hours,
        'best_sellers':    best_sellers,
        'top_clients':     top_clients,
        'daily_revenue':   daily_revenue,
        'recharges':       recharges,
        'users_growth':    users_growth,
        'orders_insights': orders_insights,
    }
    cache.set(CACHE_KEY, payload, 120)  # 2-minute TTL
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_dashboard_financials(request):
    """
    Chiffre d'affaires vs bénéfice réel: revenue, cost, net profit and margin
    for a period, plus a revenue/profit trend and a best-sellers-by-profit
    table. Admin-only - cost/profit data never appears in any client-facing
    endpoint.
    """
    from django.db.models import Sum, Count
    from django.db.models.functions import TruncDate, TruncMonth
    from django.utils import timezone
    from datetime import timedelta
    from decimal import Decimal
    from apps.orders.models import Order

    now         = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period      = request.query_params.get('period', 'month')

    period_starts = {
        'today': today_start,
        'week':  today_start - timedelta(days=7),
        'month': today_start.replace(day=1),
        'year':  today_start.replace(month=1, day=1),
        'all':   None,
    }
    start = period_starts.get(period, period_starts['month'])

    completed = Order.objects.filter(status='completed')
    if start is not None:
        completed = completed.filter(created_at__gte=start)

    agg = completed.aggregate(
        revenue=Sum('amount_paid'),
        total_cost=Sum('cost_price_at_sale'),
        net_profit=Sum('profit_at_sale'),
        orders_with_cost=Count('id', filter=Q(cost_price_at_sale__isnull=False)),
        orders_without_cost=Count('id', filter=Q(cost_price_at_sale__isnull=True)),
    )
    revenue    = float(agg['revenue'] or 0)
    total_cost = float(agg['total_cost'] or 0)
    net_profit = float(agg['net_profit'] or 0)
    avg_margin_pct = round((net_profit / revenue) * 100, 2) if revenue else 0.0

    # ── Trend: daily buckets for short periods, monthly for year/all so the
    # chart stays readable instead of plotting hundreds of daily points.
    # Zero-filled across the full period range (like the existing 30-day
    # revenue chart) so a sparse day/period still renders a real line
    # instead of the chart's "need >= 2 points" guard showing "No data yet".
    monthly = period in ('year', 'all')

    if monthly:
        # Monthly buckets: 12 months back for 'year', 24 months for 'all'
        # (matches the existing history cap used elsewhere on this endpoint).
        months_back = 24 if period == 'all' else 12
        trend_start = (today_start.replace(day=1) - timedelta(days=31 * months_back)).replace(day=1)
        trend_qs = completed.filter(created_at__gte=trend_start)
        bucket_field = TruncMonth('created_at')
    else:
        # 'today' still gets a 2-point trend (yesterday + today) so the
        # chart always has something to draw.
        span_days = {'today': 1, 'week': 7}.get(period, (now - (start or today_start)).days + 1)
        trend_start = today_start - timedelta(days=max(span_days, 1))
        trend_qs = completed.filter(created_at__gte=trend_start)
        bucket_field = TruncDate('created_at')

    trend_rows = (
        trend_qs
        .annotate(bucket=bucket_field)
        .values('bucket')
        .annotate(revenue=Sum('amount_paid'), profit=Sum('profit_at_sale'))
        .order_by('bucket')
    )
    # Normalize every bucket key to a plain 'YYYY-MM-DD' string - TruncDate
    # yields a date, TruncMonth yields a datetime, so compare as strings
    # rather than relying on the two to be the same Python type.
    def _key(v):
        return v.date().isoformat() if hasattr(v, 'date') else v.isoformat()
    trend_map = {_key(r['bucket']): r for r in trend_rows}

    profit_trend = []
    if monthly:
        cursor = trend_start
        while cursor <= today_start:
            row = trend_map.get(cursor.date().isoformat())
            profit_trend.append({
                'date':    cursor.date().isoformat(),
                'revenue': float(row['revenue'] or 0) if row else 0.0,
                'profit':  float(row['profit'] or 0) if row else 0.0,
            })
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    else:
        num_days = (today_start - trend_start).days + 1
        for i in range(num_days):
            d = (trend_start + timedelta(days=i)).date()
            row = trend_map.get(d.isoformat())
            profit_trend.append({
                'date':    d.isoformat(),
                'revenue': float(row['revenue'] or 0) if row else 0.0,
                'profit':  float(row['profit'] or 0) if row else 0.0,
            })

    # ── Best sellers by net profit (not revenue) ────────────────────────────
    by_product = (
        completed
        .filter(product__isnull=False)
        .values('product__name')
        .annotate(
            units=Sum('quantity'),
            revenue=Sum('amount_paid'),
            total_cost=Sum('cost_price_at_sale'),
            net_profit=Sum('profit_at_sale'),
        )
        .order_by('-net_profit')[:20]
    )
    best_sellers_by_profit = []
    for r in by_product:
        rev  = float(r['revenue'] or 0)
        prof = float(r['net_profit'] or 0) if r['net_profit'] is not None else None
        best_sellers_by_profit.append({
            'product_name': r['product__name'],
            'units_sold':   r['units'] or 0,
            'revenue':      rev,
            'total_cost':   float(r['total_cost']) if r['total_cost'] is not None else None,
            'net_profit':   prof,
            'margin_pct':   round((prof / rev) * 100, 2) if prof is not None and rev else None,
        })

    return Response({
        'revenue':             revenue,
        'total_cost':          total_cost,
        'net_profit':          net_profit,
        'avg_margin_pct':      avg_margin_pct,
        'orders_with_cost':    agg['orders_with_cost'],
        'orders_without_cost': agg['orders_without_cost'],
        'profit_trend':        profit_trend,
        'best_sellers_by_profit': best_sellers_by_profit,
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_stats(request):
    from django.utils import timezone
    from datetime import timedelta
    from apps.orders.models import Order

    from django.db.models import Sum
    today = timezone.now().date()
    revenue_today = Order.objects.filter(
        created_at__date=today, status='completed'
    ).aggregate(total=Sum('amount_paid'))['total'] or 0

    return Response({
        'revenue_today': revenue_today,
        'total_orders': Order.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
        'pending_recharges': RechargeRequest.objects.filter(status='pending').count(),
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_badge_counts(request):
    """Sidebar notification badges: items awaiting admin action."""
    from django.db.models import Q
    from apps.orders.models import Order
    from apps.payments.models import CryptoPayment
    from apps.tickets.models import OrderTicket, SupportTicket

    # Orders badge = notification of NEW orders since the admin last opened
    # the Orders page (cleared by admin_orders_seen below).
    new_orders = Order.objects.all()
    if request.user.orders_seen_at:
        new_orders = new_orders.filter(created_at__gt=request.user.orders_seen_at)

    return Response({
        'orders': new_orders.count(),
        # Manual recharges only — crypto ones have their own badge
        'recharges': RechargeRequest.objects.filter(status='pending').exclude(method='crypto').count(),
        'crypto': CryptoPayment.objects.filter(status__in=['pending', 'confirming']).count(),
        'order_tickets': OrderTicket.objects.filter(status__in=('open', 'in_progress')).count(),
        'support_tickets': SupportTicket.objects.filter(status__in=('open', 'in_progress')).count(),
    })


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_orders_seen(request):
    """Mark all orders as seen - clears the sidebar 'new orders' badge."""
    from django.utils import timezone
    request.user.orders_seen_at = timezone.now()
    request.user.save(update_fields=['orders_seen_at'])
    return Response({'detail': 'ok'})


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_orders(request):
    from apps.orders.models import Order
    from apps.orders.serializers import OrderSerializer
    from apps.orders.views import _order_list_queryset
    orders = _order_list_queryset().order_by('-created_at')
    status_filter = request.query_params.get('status')
    req_acc = request.query_params.get('requires_account')
    if status_filter == 'pending':
        # "Pending" covers every pre-completion state, including legacy rows
        # and orders awaiting fulfillment in escrow.
        orders = orders.filter(status__in=[
            Order.Status.PENDING, Order.Status.PENDING_CREDENTIALS, Order.Status.PAID_ESCROW,
        ])
    elif status_filter:
        orders = orders.filter(status=status_filter)
    if req_acc:
        orders = orders.filter(requires_account=True)
    search = request.query_params.get('search', '').strip()
    if search:
        term = search.lstrip('#').strip()
        if term.isdigit():
            orders = orders.filter(id=int(term))
        else:
            orders = orders.filter(user__username__icontains=term)
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 12
    result = paginator.paginate_queryset(orders, request)
    return paginator.get_paginated_response(
        OrderSerializer(result, many=True, context={'request': request}).data
    )


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_cancel_order(request, pk):
    """Admin force-cancel: refunds client, returns code to pool. Works even if code was revealed."""
    from apps.orders.models import Order, OrderCodeViewLog
    from apps.orders.serializers import OrderSerializer
    from apps.users.models import WalletTransaction
    from django.db import transaction
    from django.db import models as db_models

    try:
        order = Order.objects.select_related('code', 'user').get(pk=pk)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status == Order.Status.CANCELLED:
        return Response({'detail': 'Order is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

    if not order.code and order.status != Order.Status.COMPLETED:
        return Response({'detail': 'Only completed code orders can be cancelled here.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # `of=('self',)` restricts the row lock to the orders table. Without it, Postgres
        # rejects locking a query that LEFT OUTER JOINs a nullable relation (code is nullable)
        # with "FOR UPDATE cannot be applied to the nullable side of an outer join".
        locked = Order.objects.select_for_update(of=('self',)).select_related('code', 'user').get(pk=order.pk)

        # Return every code attached to this order (quantity>1 orders hold several)
        returned_codes = list(locked.codes.all()) or ([locked.code] if locked.code else [])
        for code in returned_codes:
            code.status = 'available'
            code.order  = None
            code.save(update_fields=['status', 'order'])

        user = locked.user
        refund = locked.amount_paid
        user.balance += refund
        # Reverse the points movement: take back points earned on this order,
        # give back points the client redeemed on it. Clamp at 0 in case the
        # earned points were already spent elsewhere.
        points_delta = locked.points_used - locked.points_earned
        user.points = max(0, user.points + points_delta)
        user.save(update_fields=['balance', 'points'])

        WalletTransaction.objects.create(
            user=user, type='credit', amount=refund,
            method='refund',
            note=f'Admin cancelled Order #{locked.id}'
        )
        if points_delta != 0:
            WalletTransaction.objects.create(
                user=user, type='credit' if points_delta > 0 else 'debit', amount=0,
                method='points',
                note=f'Points adjustment for cancelled order #{locked.id}: '
                     f'{-locked.points_earned:+d} earned reversed, {locked.points_used:+d} redeemed returned'
            )

        locked.status = Order.Status.CANCELLED
        locked.code   = None
        locked.save(update_fields=['status', 'code'])

        if locked.product:
            from apps.products.models import Product
            Product.objects.filter(pk=locked.product_id).update(
                stock_count=db_models.F('stock_count') + max(len(returned_codes), 1)
            )

    return Response(OrderSerializer(locked, context={'request': request}).data)




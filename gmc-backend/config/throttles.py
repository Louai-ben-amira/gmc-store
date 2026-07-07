from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """10 login attempts per minute per IP - brute-force protection."""
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    """5 registrations per hour per IP - account creation spam protection."""
    scope = 'register'


class PasswordResetRateThrottle(AnonRateThrottle):
    """5 password-reset requests per hour per IP - prevents email-bombing an address."""
    scope = 'password_reset'


class RechargeRateThrottle(UserRateThrottle):
    """20 recharge submissions per hour per user."""
    scope = 'recharge'


class OrderRateThrottle(UserRateThrottle):
    """30 order placements per hour per user."""
    scope = 'order'


class PromoValidateRateThrottle(UserRateThrottle):
    """60 promo code checks per hour - prevents enumeration."""
    scope = 'promo_validate'

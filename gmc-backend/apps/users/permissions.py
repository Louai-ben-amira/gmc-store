from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


def require_verified_email(user):
    """
    Gate money-moving actions (buy, top up, redeem) behind email verification.
    Existing users are grandfathered in as verified (see migration 0008), so
    this only affects unverified accounts created after the feature shipped.
    Browsing/viewing endpoints must NOT call this.
    """
    if not user.is_email_verified:
        raise PermissionDenied({
            'error': 'email_not_verified',
            'message': 'Please verify your email to continue.',
        })

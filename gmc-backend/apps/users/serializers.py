from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, WalletTransaction


class UserSerializer(serializers.ModelSerializer):
    referrals_count  = serializers.SerializerMethodField()
    referral_earned  = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'balance', 'points', 'avatar', 'phone', 'created_at',
                  'referral_code', 'referrals_count', 'referral_earned',
                  'theme_preference', 'language_preference']
        read_only_fields = ['id', 'balance', 'points', 'role', 'created_at', 'referral_code']

    def get_referrals_count(self, obj):
        return obj.referrals.count()

    def get_referral_earned(self, obj):
        from .models import ReferralBonus
        from django.db.models import Sum
        total = ReferralBonus.objects.filter(referrer=obj, was_eligible=True).aggregate(t=Sum('amount'))['t']
        return str(total or 0)


class RegisterSerializer(serializers.ModelSerializer):
    password         = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    referral_code    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email            = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'referral_code']

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        referral_code_used = validated_data.pop('referral_code', '').strip()
        user = User.objects.create_user(**validated_data)
        if referral_code_used:
            from .referral import handle_referral_signup
            handle_referral_signup(user, referral_code_used)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        data['user'] = user
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid          = serializers.CharField()
    token        = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str
        from django.contrib.auth.tokens import default_token_generator

        try:
            user_id = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError('Invalid or expired reset link.')

        if not default_token_generator.check_token(user, data['token']):
            raise serializers.ValidationError('Invalid or expired reset link.')

        data['user'] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Wrong current password.')
        return value


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ['id', 'type', 'amount', 'method', 'note', 'created_at']
        read_only_fields = fields


class AdminUserSerializer(serializers.ModelSerializer):
    orders_count          = serializers.IntegerField(read_only=True)
    referred_by_username  = serializers.CharField(source='referred_by.username', read_only=True, default=None)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'balance', 'points',
                  'is_active', 'orders_count', 'created_at',
                  'referral_code', 'referred_by_username']
        read_only_fields = ['id', 'created_at', 'referral_code', 'referred_by_username', 'orders_count']

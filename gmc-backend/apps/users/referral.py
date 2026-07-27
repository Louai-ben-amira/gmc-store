from decimal import Decimal
from django.db import transaction

BONUS_AMOUNT = Decimal('2.00')


def handle_referral_signup(new_user, referral_code_used):
    """
    Record the referral on signup. No money moves yet - bonus is pending
    until the referred user places their first order.
    """
    from .models import User, ReferralBonus

    referrer = User.objects.filter(referral_code=referral_code_used).first()
    if not referrer or referrer.pk == new_user.pk:
        return

    new_user.referred_by = referrer
    new_user.save(update_fields=['referred_by'])

    ReferralBonus.objects.get_or_create(
        referrer=referrer,
        referred_user=new_user,
        defaults={
            'amount': Decimal('0'),
            'was_eligible': False,
            'referrer_balance_at_signup': referrer.balance,
        },
    )


def handle_referral_first_purchase(buyer):
    """
    Called after every order is created. If this is the buyer's first order
    and they were referred, credit the pending bonus to the referrer now.
    """
    referrer = buyer.referred_by
    if not referrer:
        return

    from .models import ReferralBonus, WalletTransaction
    bonus = ReferralBonus.objects.filter(
        referrer=referrer,
        referred_user=buyer,
        was_eligible=False,
    ).first()
    if not bonus:
        return  # already credited or no pending record

    from apps.orders.models import Order
    if Order.objects.filter(user=buyer).count() != 1:
        return  # not their first order

    with transaction.atomic():
        referrer.balance += BONUS_AMOUNT
        referrer.save(update_fields=['balance'])

        WalletTransaction.objects.create(
            user          = referrer,
            type          = 'credit',
            amount        = BONUS_AMOUNT,
            balance_after = referrer.balance,
            method        = 'referral',
            note          = f"Referral bonus - {buyer.get_full_name() or buyer.username} placed their first order",
        )

        bonus.was_eligible = True
        bonus.amount       = BONUS_AMOUNT
        bonus.save(update_fields=['was_eligible', 'amount'])

    _send_referral_notification(referrer, buyer)


def _send_referral_notification(referrer, buyer):
    from apps.notifications.services import notify
    display = buyer.get_full_name() or buyer.username
    notify(
        referrer, 'referral_bonus', 'Referral Bonus Earned',
        f'{display} joined with your code — +{BONUS_AMOUNT:.2f} DT added to your wallet.',
        link='/wallet',
    )

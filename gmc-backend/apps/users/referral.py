from decimal import Decimal
from django.db import transaction

MIN_BALANCE_THRESHOLD = Decimal('10.00')
BONUS_AMOUNT          = Decimal('2.00')


def handle_referral_signup(new_user, referral_code_used):
    from .models import User, WalletTransaction, ReferralBonus

    referrer = User.objects.filter(referral_code=referral_code_used).first()
    if not referrer or referrer.pk == new_user.pk:
        return

    new_user.referred_by = referrer
    new_user.save(update_fields=['referred_by'])

    is_eligible = referrer.balance >= MIN_BALANCE_THRESHOLD

    with transaction.atomic():
        referrer_balance_snapshot = referrer.balance

        if is_eligible:
            referrer.balance += BONUS_AMOUNT
            referrer.save(update_fields=['balance'])

            WalletTransaction.objects.create(
                user          = referrer,
                type          = 'credit',
                amount        = BONUS_AMOUNT,
                balance_after = referrer.balance,
                method        = 'referral',
                note          = f"Referral bonus — {new_user.get_full_name() or new_user.username} signed up with your code",
            )

        ReferralBonus.objects.create(
            referrer                   = referrer,
            referred_user              = new_user,
            amount                     = BONUS_AMOUNT if is_eligible else Decimal('0'),
            was_eligible               = is_eligible,
            referrer_balance_at_signup = referrer_balance_snapshot,
        )

    if is_eligible:
        _send_referral_notification(referrer, new_user)


def _send_referral_notification(referrer, new_user):
    try:
        from apps.chat.models import Conversation, Message
        conv, _ = Conversation.objects.get_or_create(client=referrer)
        display = new_user.get_full_name() or new_user.username
        Message.objects.create(
            conversation = conv,
            sender       = referrer,
            body         = f"Referral Bonus! +2.00 DT — {display} joined using your code!",
            msg_type     = 'text',
        )
    except Exception:
        pass

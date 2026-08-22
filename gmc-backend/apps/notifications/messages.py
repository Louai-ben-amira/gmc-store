"""
Notification copy, per event, in both site languages.

Every user carries a `language_preference` ('en' / 'ar'), so notification text
is resolved per recipient rather than hard-coded. Add an event here once and
`services.notify_event()` handles picking the right language everywhere.

Each entry is:  key -> {'type', 'en': (title, body), 'ar': (title, body)}
Bodies are .format()-ed with whatever kwargs the caller passes.
"""

EVENTS = {
    'order_complete': {
        'type': 'order_complete',
        'en': ('✅ Your order is ready!',
               '{product} — tap to reveal your code'),
        'ar': ('✅ طلبك جاهز!',
               '{product} — اضغط لإظهار الكود'),
    },
    'recharge_approved': {
        'type': 'recharge_approved',
        'en': ('💰 Wallet topped up!',
               '{amount} DT has been added to your wallet'),
        'ar': ('💰 تم شحن رصيدك!',
               'تمت إضافة {amount} DT إلى محفظتك'),
    },
    'recharge_rejected': {
        'type': 'recharge_rejected',
        'en': ('❌ Top-up request rejected',
               'Reason: {reason}'),
        'ar': ('❌ تم رفض طلب الشحن',
               'السبب: {reason}'),
    },
    'ticket_reply': {
        'type': 'ticket_reply',
        'en': ('💬 New reply on your ticket',
               'Ticket #{ticket_id} — {subject}'),
        'ar': ('💬 رد جديد على تذكرتك',
               'التذكرة #{ticket_id} — {subject}'),
    },
    'referral_bonus': {
        'type': 'referral_bonus',
        'en': ('🎁 Referral bonus!',
               '+{amount} DT — your friend joined using your code'),
        'ar': ('🎁 مكافأة الإحالة!',
               '+{amount} DT — صديقك انضم باستخدام كودك'),
    },
    'tier_upgrade': {
        'type': 'tier_upgrade',
        'en': ('⭐ VIP upgrade!',
               'Congratulations! You reached {tier} tier'),
        'ar': ('⭐ ترقية VIP!',
               'تهانينا! وصلت إلى مستوى {tier}'),
    },
    'preorder_fulfilled': {
        'type': 'preorder_fulfilled',
        'en': ('🎉 Your pre-order is ready!',
               '{product} — {amount} DT was deducted'),
        'ar': ('🎉 طلبك المسبق جاهز!',
               '{product} — تم خصم {amount} DT'),
    },
    'preorder_failed': {
        'type': 'preorder_failed',
        'en': ('⚠️ Pre-order delivery failed',
               'Your balance is not enough for {product}'),
        'ar': ('⚠️ فشل تسليم الطلب المسبق',
               'رصيدك غير كافٍ لـ {product}'),
    },
    'preorder_placed': {
        'type': 'preorder_placed',
        'en': ('📋 Pre-order placed',
               "You're #{position} in queue for {product}. No payment until your code arrives."),
        'ar': ('📋 تم تسجيل طلبك المسبق',
               'أنت رقم #{position} في قائمة الانتظار لـ {product}. لا دفع حتى وصول الكود.'),
    },
    'order_complete_basket': {
        'type': 'order_complete',
        'en': ('✅ Your order is ready!',
               'Your basket ({count} items) is ready — tap to reveal your codes'),
        'ar': ('✅ طلبك جاهز!',
               'سلتك ({count} منتجات) جاهزة — اضغط لإظهار الأكواد'),
    },
    'flash_sale': {
        'type': 'flash_sale',
        'en': ('🔥 Flash sale is live!',
               '{product} — {pct}% off for a limited time'),
        'ar': ('🔥 عرض خاطف الآن!',
               '{product} — خصم {pct}% لفترة محدودة'),
    },
    'wishlist_price_drop': {
        'type': 'wishlist_price_drop',
        'en': ('📉 Price drop on your wishlist',
               '{product} dropped to {price} DT'),
        'ar': ('📉 انخفض سعر منتج في قائمتك',
               '{product} أصبح بـ {price} DT'),
    },
    'preorder_reminder': {
        'type': 'preorder_reminder',
        'en': ('⏰ 1 hour left to cancel',
               'Your free-cancellation window for {product} closes in about an hour.'),
        'ar': ('⏰ ساعة واحدة متبقية للإلغاء',
               'تنتهي فترة الإلغاء المجاني لـ {product} خلال ساعة تقريبًا.'),
    },
}


def resolve(key, lang='en', **params):
    """
    (type, title, body) for an event key in the given language.
    Falls back to English for an unknown language, and leaves the body
    untouched if a caller forgets a placeholder rather than blowing up.
    """
    event = EVENTS[key]
    title, body = event.get(lang) or event['en']
    try:
        body = body.format(**params)
    except (KeyError, IndexError):
        pass
    return event['type'], title, body

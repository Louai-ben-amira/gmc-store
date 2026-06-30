from pathlib import Path
from decouple import config
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')

# ── HTTPS / Security (active when DEBUG=False) ───────────────────────────────
if not DEBUG:
    SECURE_SSL_REDIRECT             = True
    SECURE_PROXY_SSL_HEADER         = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS             = 31_536_000   # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
    SECURE_HSTS_PRELOAD             = True
    SESSION_COOKIE_SECURE           = True
    CSRF_COOKIE_SECURE              = True
    CSRF_COOKIE_SAMESITE            = 'Lax'
    SESSION_COOKIE_SAMESITE         = 'Lax'

# Always-on security headers (safe in dev too)
SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS              = 'DENY'
SECURE_REFERRER_POLICY       = 'strict-origin-when-cross-origin'

INSTALLED_APPS = [
    'daphne',
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'django_celery_beat',
    # Local apps
    'apps.users',
    'apps.products',
    'apps.orders',
    'apps.chat',
    'apps.payments',
    # Auto-deletes old files from storage (R2) when a model row is deleted or
    # its FileField/ImageField changes. MUST stay last so its signals are
    # registered after every model is loaded.
    'django_cleanup.apps.CleanupConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

_DATABASE_URL = config('DATABASE_URL', default='')
if _DATABASE_URL:
    from urllib.parse import urlparse, parse_qs

    _u = urlparse(_DATABASE_URL)
    _q = parse_qs(_u.query)
    _opts = {}
    if 'sslmode' in _q:
        _opts['sslmode'] = _q['sslmode'][0]
    if 'channel_binding' in _q:
        _opts['channel_binding'] = _q['channel_binding'][0]
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': _u.path.lstrip('/'),
            'USER': _u.username,
            'PASSWORD': _u.password,
            'HOST': _u.hostname,
            'PORT': _u.port or 5432,
            'OPTIONS': _opts,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='gmc_store'),
            'USER': config('DB_USER', default='postgres'),
            'PASSWORD': config('DB_PASSWORD', default='password'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            'OPTIONS': {'sslmode': config('DB_SSLMODE', default='prefer')},
        }
    }

REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/0')

# Use in-memory cache in dev so Redis is not required to run the server.
# In production Redis handles cache, channel layers, and Celery all in one.
if DEBUG:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'capacity': 1500,
            'expiry': 10,
        },
    },
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Run tasks inline in the web process so NO separate Celery worker service is
# needed (emails / Telegram alerts send during the request — fine for low volume).
# Flash-sale expiry is handled lazily in the model, so no Celery Beat is needed either.
# If you later add a dedicated worker, set CELERY_TASK_ALWAYS_EAGER=False in its env
# and run:  celery -A config worker -B -l info
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=True, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = True

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Local fallback for media (used only when R2 is not configured — see below).
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── File storage: Cloudflare R2 (S3-compatible) ──────────────────────────────
# Credentials come from the environment. We accept both the canonical names and
# the legacy R2_*_ID / R2_S3_* names so existing .env files keep working.
def _first(*names: str, default: str = '') -> str:
    for name in names:
        value = config(name, default='')
        if value:
            return value
    return default


R2_ACCESS_KEY   = _first('R2_ACCESS_KEY', 'R2_ACCESS_KEY_ID')
R2_SECRET_KEY   = _first('R2_SECRET_KEY', 'R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME  = _first('R2_BUCKET_NAME', 'R2_STORAGE_BUCKET_NAME')
R2_ACCOUNT_ID   = config('R2_ACCOUNT_ID', default='')
R2_ENDPOINT_URL = _first(
    'R2_ENDPOINT_URL', 'R2_S3_ENDPOINT_URL',
    default=(f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com' if R2_ACCOUNT_ID else ''),
)
# Public bucket URL (r2.dev or a custom domain). When set, files are served
# unsigned through this domain; when empty, URLs are signed (querystring auth).
R2_PUBLIC_URL = config('R2_PUBLIC_URL', default='')
if R2_PUBLIC_URL:
    from urllib.parse import urlparse as _urlparse
    R2_CUSTOM_DOMAIN = _urlparse(R2_PUBLIC_URL).netloc or R2_PUBLIC_URL.strip('/')
else:
    R2_CUSTOM_DOMAIN = ''
R2_QUERYSTRING_AUTH = not bool(R2_CUSTOM_DOMAIN)

# Use R2 only when fully configured; otherwise fall back to the local
# filesystem so development works with no cloud credentials.
USE_R2 = bool(R2_ACCESS_KEY and R2_SECRET_KEY and R2_BUCKET_NAME and R2_ENDPOINT_URL)

_DEFAULT_STORAGE = (
    'config.storage_backends.R2Storage' if USE_R2
    else 'django.core.files.storage.FileSystemStorage'
)
STORAGES = {
    'default': {'BACKEND': _DEFAULT_STORAGE},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173'
).split(',')
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 12,
    'DEFAULT_THROTTLE_RATES': {
        'anon':           '120/minute',
        'user':           '600/minute',
        'login':          '10/minute',
        'register':       '5/hour',
        'recharge':       '20/hour',
        'order':          '30/hour',
        'promo_validate': '60/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

EMAIL_HOST = config('EMAIL_HOST', default='smtp.mailgun.org')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@gmcstore.com')
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

# Use console backend in development when SMTP credentials aren't configured,
# so password-reset / order emails print to terminal instead of silently failing.
if DEBUG and not EMAIL_HOST_USER:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

POINTS_RATE        = 1    # points earned per DT spent

GOOGLE_CLIENT_ID    = config('GOOGLE_CLIENT_ID',    default='')
LOW_STOCK_THRESHOLD = config('LOW_STOCK_THRESHOLD', default=3, cast=int)

# ── Telegram alerts ──────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = config('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_CHAT_ID   = config('TELEGRAM_CHAT_ID',   default='')

# ── Celery Beat schedule ─────────────────────────────────────────────────────
CELERY_BEAT_SCHEDULE = {
    'expire-flash-sales-every-minute': {
        'task':     'apps.products.tasks.expire_flash_sales',
        'schedule': 60.0,
    },
}

JAZZMIN_SETTINGS = {
    'site_title': 'GMC Store Admin',
    'site_header': 'GMC Store',
    'site_brand': 'GMC Store',
    'welcome_sign': 'Welcome to GMC Store Admin',
    'copyright': 'GMC Store',
    'search_model': ['users.User', 'products.Product', 'orders.Order'],
    'topmenu_links': [
        {'name': 'Home', 'url': 'admin:index', 'permissions': ['auth.view_user']},
        {'name': 'Site', 'url': '/', 'new_window': True},
    ],
    'show_sidebar': True,
    'navigation_expanded': True,
    'order_with_respect_to': [
        'products', 'orders', 'payments', 'users', 'chat', 'auth',
        'products.product', 'products.category', 'products.code', 'products.bundle',
        'orders.order',
        'payments.rechargerequest', 'payments.giftcardbatch', 'payments.cryptopayment', 'payments.sitesettings',
        'users.user', 'users.wallettransaction',
        'chat.conversation', 'chat.message',
    ],
    'icons': {
        'auth': 'fas fa-users-cog',
        'users': 'fas fa-users',
        'users.user': 'fas fa-user',
        'users.wallettransaction': 'fas fa-exchange-alt',
        'products': 'fas fa-gamepad',
        'products.product': 'fas fa-box',
        'products.category': 'fas fa-tags',
        'products.code': 'fas fa-key',
        'products.bundle': 'fas fa-layer-group',
        'orders': 'fas fa-shopping-cart',
        'orders.order': 'fas fa-receipt',
        'payments': 'fas fa-credit-card',
        'payments.rechargerequest': 'fas fa-wallet',
        'payments.giftcardbatch': 'fas fa-gift',
        'payments.cryptopayment': 'fab fa-bitcoin',
        'payments.sitesettings': 'fas fa-cog',
        'chat': 'fas fa-comments',
        'chat.conversation': 'fas fa-comment-dots',
        'chat.message': 'fas fa-envelope',
    },
    'default_icon_parents': 'fas fa-chevron-circle-right',
    'default_icon_children': 'fas fa-circle',
    'related_modal_active': True,
    'use_google_fonts_cdn': True,
    'show_ui_builder': False,
    'language_chooser': False,
}

JAZZMIN_UI_TWEAKS = {
    'theme': 'darkly',
    'dark_mode_theme': 'darkly',
    'navbar': 'navbar-dark',
    'sidebar': 'sidebar-dark-purple',
    'sidebar_nav_child_indent': True,
    'navbar_fixed': True,
    'sidebar_fixed': True,
    'button_classes': {
        'primary': 'btn-primary',
        'secondary': 'btn-secondary',
        'info': 'btn-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
}

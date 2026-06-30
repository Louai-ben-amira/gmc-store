"""
GMC Store Test Suite — Configuration
Set these via environment variables before running.
"""
import os

# ── Target ─────────────────────────────────────────────────────────────────
# Staging server base URL (NO trailing slash, WITH /api suffix)
BASE_URL = os.getenv('TEST_BASE_URL', 'http://localhost:8000/api')

# ── Admin credentials ───────────────────────────────────────────────────────
ADMIN_USERNAME = os.getenv('TEST_ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.getenv('TEST_ADMIN_PASS', 'Admin1234!')

# ── Generated test account password (must meet Django's validators) ─────────
TEST_USER_PASSWORD = os.getenv('TEST_USER_PASS', 'GMCtest9999!')

# ── Prefix that marks every resource created by this suite ─────────────────
# Makes cleanup easy: DELETE WHERE username LIKE 'gmc_t_%'
TEST_PREFIX = 'gmc_t_'

# ── Timeouts ────────────────────────────────────────────────────────────────
REQUEST_TIMEOUT   = 15   # seconds per single HTTP request
BARRIER_TIMEOUT   = 10   # seconds barrier waits before all threads are ready
CONCURRENT_JOIN   = 30   # seconds to wait for all concurrent threads to finish

# ── Referral bonus amount (must match apps/users/referral.py:BONUS_AMOUNT) ──
REFERRAL_BONUS = 2.00

# ── Throttle limits (from config/throttles.py — used for security tests) ───
LOGIN_RATE_LIMIT   = 10   # attempts per minute per IP
ORDER_RATE_LIMIT   = 30   # orders per hour per user
RECHARGE_RATE_LIMIT = 20  # recharges per hour per user

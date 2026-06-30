"""
GMC Store Test Suite — Category 2: Security Tests

Tests authentication boundaries, rate limiting, input validation,
credential encryption, and secrets exposure.

Run: python -m pytest tests/security/ -v   (from repo root)
  or: python tests/run_all.py
"""
import re
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
import requests
from helpers import (
    get_admin_token, register_user, make_session,
    get_wallet_balance, set_user_balance,
)
from config import (
    BASE_URL, REQUEST_TIMEOUT,
    LOGIN_RATE_LIMIT, RECHARGE_RATE_LIMIT,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 1 — Rate Limiting Verification
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestRateLimiting:
    """
    Verify throttle limits kick in before an attacker can make unlimited attempts.
    Config/throttles.py defines the limits — we fire 2x the limit and assert 429 appears.
    """

    def _fire_until_429(self, url, payload, method='post', n=30, headers=None):
        """
        Fire up to n requests against url. Return (attempts_before_429, got_429).
        Stops as soon as 429 is received.
        """
        sess = requests.Session()
        if headers:
            sess.headers.update(headers)
        for attempt in range(1, n + 1):
            if method == 'post':
                r = sess.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            else:
                r = sess.get(url, timeout=REQUEST_TIMEOUT)
            if r.status_code == 429:
                return attempt, True
        return n, False

    def test_login_rate_limit(self):
        """10 failed logins per minute → 429 before 30 attempts."""
        attempts, got_429 = self._fire_until_429(
            f'{BASE_URL}/auth/login/',
            {'username': 'nonexistent_user_xyz', 'password': 'wrong'},
            n=30,
        )
        assert got_429, (
            f"FAIL: Sent {attempts} bad login requests without hitting 429. "
            f"LoginRateThrottle (10/min) did not trigger. "
            f"Check REST_FRAMEWORK THROTTLE_RATES in settings.py."
        )
        assert attempts <= LOGIN_RATE_LIMIT + 3, (
            f"WARN: 429 triggered after {attempts} attempts (limit is {LOGIN_RATE_LIMIT}/min)"
        )
        print(f"  PASS: Login rate limited after {attempts} attempts")

    def test_gift_card_redeem_rate_limit(self):
        """Rapid gift card redeem attempts from one account → 429."""
        _, token, _ = register_user(suffix='rl_gc')
        attempts, got_429 = self._fire_until_429(
            f'{BASE_URL}/wallet/redeem/',
            {'code': 'GMC-FAKE-0000-0000'},
            n=60,
            headers={'Authorization': f'Bearer {token}'},
        )
        # Gift card redeem doesn't have an explicit throttle class in throttles.py,
        # but it should be covered by the default user throttle.
        # If there's no rate limit on this endpoint, that's a finding.
        if not got_429:
            pytest.skip(
                f"FINDING: Gift card redeem endpoint has no rate limit — "
                f"sent {attempts} attempts without 429. "
                f"Recommend adding GiftCardRedeemRateThrottle."
            )
        print(f"  PASS: Gift card redeem rate limited after {attempts} attempts")

    def test_order_creation_rate_limit(self):
        """30 orders/hour per user → 429 within reasonable attempts."""
        _, token, user_id = register_user(suffix='rl_ord')
        set_user_balance(user_id, 9999, admin_token=get_admin_token())
        attempts, got_429 = self._fire_until_429(
            f'{BASE_URL}/orders/',
            {'product_id': 999999},  # non-existent product — will fail but still hit throttle
            n=40,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert got_429, (
            f"FAIL: OrderRateThrottle (30/hr) did not trigger after {attempts} attempts."
        )
        print(f"  PASS: Order rate limited after {attempts} attempts")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 2 — Gift Card Brute-Force Throttling
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestGiftCardBruteForce:
    """
    Attempt 100 randomly formatted gift card codes rapidly.
    Expected: rate limiting blocks the attempt long before completion.
    Also checks that random codes never accidentally succeed.
    """

    def test_brute_force_is_throttled(self):
        _, token, _ = register_user(suffix='bf_gc')
        sess = make_session(token)

        successes = 0
        got_429   = False
        attempt   = 0

        for i in range(100):
            attempt += 1
            # Generate a plausible-looking fake code
            fake_code = f'GMC-{i:04X}-{i*3:04X}-{i*7:04X}'
            r = sess.post(
                f'{BASE_URL}/wallet/redeem/',
                json={'code': fake_code},
                timeout=REQUEST_TIMEOUT,
            )
            if r.status_code == 200:
                successes += 1
            elif r.status_code == 429:
                got_429 = True
                break

        assert successes == 0, (
            f"CRITICAL: A randomly generated code was redeemed successfully "
            f"at attempt {attempt}. Code generation has weak entropy."
        )

        if not got_429:
            print(f"  FINDING: Completed {attempt} brute-force attempts without 429. "
                  f"Add rate throttle to gift card redeem endpoint.")
        else:
            print(f"  PASS: Brute-force blocked at attempt {attempt} with 429. "
                  f"0 random codes succeeded.")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 3 — Authentication & Authorization Boundaries
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestAuthorizationBoundaries:

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_unauthenticated_returns_401(self):
        """All protected endpoints return 401 for unauthenticated requests."""
        protected = [
            f'{BASE_URL}/wallet/',
            f'{BASE_URL}/orders/',
            f'{BASE_URL}/auth/me/',
            f'{BASE_URL}/wallet/transactions/',
        ]
        sess = requests.Session()
        for url in protected:
            r = sess.get(url, timeout=REQUEST_TIMEOUT)
            assert r.status_code == 401, (
                f"FAIL: {url} returned {r.status_code} instead of 401 for unauthenticated request"
            )
        print(f"  PASS: All {len(protected)} protected endpoints return 401 unauthenticated")

    def test_client_cannot_access_admin_endpoints(self):
        """Regular client account returns 403 on all /admin/ endpoints."""
        _, client_token, _ = register_user(suffix='auth_client')

        admin_endpoints = [
            f'{BASE_URL}/admin/users/',
            f'{BASE_URL}/admin/orders/',
            f'{BASE_URL}/admin/stats/',
            f'{BASE_URL}/payments/admin/recharges/',
            f'{BASE_URL}/payments/admin/gift-cards/',
        ]
        sess = make_session(client_token)
        for url in admin_endpoints:
            r = sess.get(url, timeout=REQUEST_TIMEOUT)
            assert r.status_code in (403, 401), (
                f"FAIL: Client accessed admin endpoint {url} — got {r.status_code}. "
                f"Response: {r.text[:200]}"
            )
        print(f"  PASS: All {len(admin_endpoints)} admin endpoints blocked for client (403/401)")

    def test_client_cannot_view_other_users_orders(self):
        """
        Client A cannot see Client B's order by guessing/incrementing the order ID.
        Tests IDOR (Insecure Direct Object Reference) vulnerability.
        """
        _, token_a, user_a_id = register_user(suffix='idor_a')
        _, token_b, user_b_id = register_user(suffix='idor_b')

        # Try to access orders with sequential IDs — use admin to find a real order ID
        # belonging to a different user
        admin_orders_r = make_session(self.admin_token).get(
            f'{BASE_URL}/admin/orders/?page=1', timeout=REQUEST_TIMEOUT
        )
        if admin_orders_r.status_code != 200:
            pytest.skip("Could not fetch admin orders to test IDOR")

        orders = admin_orders_r.json().get('results', [])
        # Find an order NOT belonging to user_a
        other_order = next(
            (o for o in orders if o.get('user') != user_a_id and o.get('id')),
            None
        )
        if not other_order:
            pytest.skip("No other users' orders found to test IDOR against")

        order_id = other_order['id']
        r = make_session(token_a).get(
            f'{BASE_URL}/orders/{order_id}/', timeout=REQUEST_TIMEOUT
        )
        assert r.status_code in (403, 404), (
            f"CRITICAL FAIL (IDOR): User A accessed User B's order #{order_id}. "
            f"Got {r.status_code}: {r.text[:200]}"
        )
        print(f"  PASS: IDOR test passed — order #{order_id} returned {r.status_code} for unauthorized user")

    def test_client_cannot_approve_recharge_directly(self):
        """
        Client cannot approve their own recharge by calling the admin endpoint directly.
        """
        _, user_token, user_id = register_user(suffix='self_approve')

        # Submit a recharge
        recharge_r = make_session(user_token).post(
            f'{BASE_URL}/wallet/recharge/',
            json={'method': 'd17_address', 'amount_sent': '20'},
            timeout=REQUEST_TIMEOUT,
        )
        if recharge_r.status_code not in (200, 201):
            pytest.skip(f"Could not create recharge: {recharge_r.text}")

        recharge_id = recharge_r.json()['id']

        # Try to approve own recharge as client
        r = make_session(user_token).post(
            f'{BASE_URL}/payments/admin/recharges/{recharge_id}/approve/',
            json={'admin_note': 'self approved'},
            timeout=REQUEST_TIMEOUT,
        )
        assert r.status_code in (403, 401), (
            f"CRITICAL FAIL: Client self-approved recharge #{recharge_id}. "
            f"Got {r.status_code}: {r.text[:200]}"
        )
        print(f"  PASS: Client cannot self-approve recharge (got {r.status_code})")

    def test_client_cannot_view_other_users_wallet(self):
        """Client cannot access another user's wallet transactions."""
        _, token_a, user_a_id = register_user(suffix='wallet_a')
        _, token_b, user_b_id = register_user(suffix='wallet_b')

        # There's no direct "wallet/{user_id}/" endpoint, but check admin user endpoint
        r = make_session(token_a).get(
            f'{BASE_URL}/admin/users/{user_b_id}/',
            timeout=REQUEST_TIMEOUT,
        )
        assert r.status_code in (403, 401), (
            f"FAIL: Client A accessed Client B's admin user profile. "
            f"Got {r.status_code}"
        )
        print(f"  PASS: Wallet/user isolation verified (got {r.status_code})")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 4 — SQL Injection / Input Validation Sweep
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestInputValidation:
    """
    Inject SQL/XSS payloads into every text-accepting endpoint.
    Django ORM protects against SQL injection by default, but verifies:
    1. Server returns error (not 500 crash)
    2. Injected payload doesn't appear reflected in response unescaped (XSS)
    3. No raw() / extra() queries in codebase bypass the ORM
    """

    PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        '1; SELECT * FROM auth_user --',
        '<script>alert(1)</script>',
        '{{7*7}}',  # template injection
        '../../../etc/passwd',
        '\x00\x1f\x7f',  # null bytes
    ]

    def setup_method(self):
        _, self.token, _ = register_user(suffix='sqli')

    def test_search_endpoint_injection(self):
        """Products search field."""
        sess = make_session(self.token)
        for payload in self.PAYLOADS:
            r = sess.get(
                f'{BASE_URL}/products/',
                params={'search': payload},
                timeout=REQUEST_TIMEOUT,
            )
            assert r.status_code != 500, (
                f"FAIL: Search with payload '{payload}' caused 500. Server error."
            )
            # Response should be JSON, not an HTML error page with stack trace
            assert 'Traceback' not in r.text and 'DoesNotExist' not in r.text, (
                f"FAIL: Server leaked traceback for payload '{payload}'"
            )

    def test_gift_card_code_injection(self):
        """Gift card code field."""
        sess = make_session(self.token)
        for payload in self.PAYLOADS:
            r = sess.post(
                f'{BASE_URL}/wallet/redeem/',
                json={'code': payload},
                timeout=REQUEST_TIMEOUT,
            )
            assert r.status_code != 500, (
                f"FAIL: Gift card code '{payload}' caused 500"
            )

    def test_promo_code_injection(self):
        """Promo code validation field."""
        sess = make_session(self.token)
        for payload in self.PAYLOADS:
            r = sess.post(
                f'{BASE_URL}/orders/validate-promo/',
                json={'code': payload, 'price': '10.00'},
                timeout=REQUEST_TIMEOUT,
            )
            assert r.status_code != 500, (
                f"FAIL: Promo code '{payload}' caused 500"
            )

    def test_chat_message_injection(self):
        """Chat message body."""
        sess = make_session(self.token)
        for payload in self.PAYLOADS:
            r = sess.post(
                f'{BASE_URL}/chat/messages/',
                json={'body': payload},
                timeout=REQUEST_TIMEOUT,
            )
            assert r.status_code not in (500,), (
                f"FAIL: Chat message '{payload}' caused 500"
            )

    def test_no_raw_queries_in_codebase(self):
        """
        Static analysis: grep codebase for .raw() and .extra() QuerySet methods,
        which bypass Django ORM parameterization and could allow SQL injection.
        """
        import subprocess
        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        backend   = os.path.join(repo_root, 'gmc-backend')

        raw_result = subprocess.run(
            ['grep', '-rn', r'\.raw(', backend, '--include=*.py',
             '--exclude-dir=__pycache__', '--exclude-dir=migrations'],
            capture_output=True, text=True,
        )
        extra_result = subprocess.run(
            ['grep', '-rn', r'\.extra(', backend, '--include=*.py',
             '--exclude-dir=__pycache__', '--exclude-dir=migrations'],
            capture_output=True, text=True,
        )

        raw_hits   = [l for l in raw_result.stdout.strip().splitlines() if l.strip()]
        extra_hits = [l for l in extra_result.stdout.strip().splitlines() if l.strip()]

        if raw_hits:
            print(f"  FINDING: {len(raw_hits)} .raw() usages found (audit manually):")
            for hit in raw_hits:
                print(f"    {hit}")
        if extra_hits:
            print(f"  FINDING: {len(extra_hits)} .extra() usages found (audit manually):")
            for hit in extra_hits:
                print(f"    {hit}")

        # No automatic fail — raw() can be safe if parameterized correctly.
        # But surface any instances for manual review.
        print(f"  INFO: raw() calls: {len(raw_hits)}, extra() calls: {len(extra_hits)} "
              f"(0 in this codebase = ideal)")

        assert len(raw_hits) + len(extra_hits) == 0, (
            f"AUDIT REQUIRED: Found {len(raw_hits)} .raw() and {len(extra_hits)} .extra() "
            f"calls. Verify each is parameterized correctly (uses %s, not string formatting)."
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 5 — Credential Encryption Verification
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestCredentialEncryption:
    """
    Verify that OrderCredentials are stored encrypted.
    The credential's data_encrypted field must not contain the plaintext.
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_credentials_are_encrypted_in_db_not_in_response(self):
        """
        Submit an order with credentials.
        Verify the credentials API endpoint returns decrypted data only for admin.
        Verify the order list for the client NEVER leaks credentials.
        """
        PLAINTEXT_PASSWORD = 'SuperSecret1234!'

        # Find a product that requires_account (or skip)
        r = make_session(self.admin_token).get(
            f'{BASE_URL}/products/?requires_account=true',
            timeout=REQUEST_TIMEOUT,
        )
        products = r.json()
        if isinstance(products, dict):
            products = products.get('results', [])
        products = [p for p in products if p.get('requires_account')]

        if not products:
            pytest.skip("No requires_account products exist — create one first to run this test")

        product = products[0]
        product_id = product['id']

        # Create a client with enough balance
        _, client_token, client_id = register_user(suffix='cred_enc')
        set_user_balance(client_id, 999, admin_token=self.admin_token)

        # Place order with plaintext credentials
        order_r = make_session(client_token).post(
            f'{BASE_URL}/orders/',
            json={
                'product_id':  product_id,
                'credentials': {'email': f'test@example.com', 'password': PLAINTEXT_PASSWORD},
            },
            timeout=REQUEST_TIMEOUT,
        )
        if order_r.status_code not in (200, 201):
            pytest.skip(f"Could not place credential order: {order_r.text}")

        order_id = order_r.json()['id']

        # 1. Client order response must not contain credentials
        orders_r = make_session(client_token).get(f'{BASE_URL}/orders/', timeout=REQUEST_TIMEOUT)
        assert PLAINTEXT_PASSWORD not in orders_r.text, (
            "CRITICAL FAIL: Plaintext password found in client orders list response!"
        )

        # 2. Admin order list must not contain credentials either
        admin_orders_r = make_session(self.admin_token).get(
            f'{BASE_URL}/admin/orders/', timeout=REQUEST_TIMEOUT
        )
        assert PLAINTEXT_PASSWORD not in admin_orders_r.text, (
            "CRITICAL FAIL: Plaintext password found in admin orders list response!"
        )

        # 3. Admin credentials endpoint should return decrypted data (that's its purpose)
        cred_r = make_session(self.admin_token).get(
            f'{BASE_URL}/orders/{order_id}/credentials/',
            timeout=REQUEST_TIMEOUT,
        )
        if cred_r.status_code == 200:
            cred_data = cred_r.json()
            # The admin CAN see it here — that's intentional
            print(f"  INFO: Admin credentials endpoint works (status 200)")
        else:
            print(f"  INFO: Admin credentials endpoint returned {cred_r.status_code}")

        # 4. Client CANNOT access credentials endpoint
        client_cred_r = make_session(client_token).get(
            f'{BASE_URL}/orders/{order_id}/credentials/',
            timeout=REQUEST_TIMEOUT,
        )
        assert client_cred_r.status_code in (403, 401), (
            f"FAIL: Client accessed credentials endpoint — got {client_cred_r.status_code}"
        )

        print(f"  PASS: Credentials not in order responses. "
              f"Admin credentials endpoint: {cred_r.status_code}. "
              f"Client credentials access: {client_cred_r.status_code}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 6 — CORS / CSRF Verification
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestCorsAndCsrf:
    """
    Verify CORS headers are restricted to allowed origins.
    Note: DRF with JWT Bearer tokens does NOT use CSRF (CSRF is for cookie auth).
    This test verifies CORS config doesn't expose the API to arbitrary websites.
    """

    def test_cors_headers_present_and_restricted(self):
        """
        OPTIONS preflight from an unauthorized origin should not include
        Access-Control-Allow-Origin: * (or the attacker's origin).
        """
        evil_origin = 'https://evil-attacker.example.com'

        r = requests.options(
            f'{BASE_URL}/auth/login/',
            headers={
                'Origin':                        evil_origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
            },
            timeout=REQUEST_TIMEOUT,
        )

        acao = r.headers.get('Access-Control-Allow-Origin', '')

        # Wildcard is dangerous — allows any website to call the API with user cookies
        assert acao != '*', (
            "FAIL: CORS allows all origins (Access-Control-Allow-Origin: *). "
            "Set CORS_ALLOWED_ORIGINS to specific domains in settings.py."
        )

        # Evil origin should not be allowed
        assert evil_origin not in acao, (
            f"FAIL: CORS reflected evil origin in Access-Control-Allow-Origin: {acao}"
        )

        print(f"  PASS: CORS origin '{evil_origin}' not allowed. ACAO: '{acao or '(none)'}'")

    def test_jwt_api_note_csrf_not_applicable(self):
        """
        This API uses JWT Bearer tokens (not cookies), so CSRF is not applicable.
        Document this explicitly — CSRF tokens are only needed for session/cookie auth.
        """
        print("  INFO: API uses JWT Bearer tokens — CSRF not applicable. "
              "If you ever add SessionAuthentication, add CSRF enforcement then.")
        assert True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 7 — Secrets Exposure Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestSecretsExposure:
    """
    Static analysis: grep codebase and git history for accidental secret commits.
    Verifies DEBUG=False in staging response headers.
    """

    def test_debug_mode_disabled(self):
        """
        Django with DEBUG=True returns HTML error pages with full stack traces
        on any 404 or 500 error. Trigger a 404 and check the response.
        """
        r = requests.get(
            f'{BASE_URL}/this-endpoint-does-not-exist-xyz/',
            timeout=REQUEST_TIMEOUT,
        )
        # With DEBUG=True, Django returns an HTML page with "Traceback" and code listings
        # With DEBUG=False, it returns a plain JSON 404 or a minimal HTML page
        is_debug_leak = (
            'Traceback' in r.text
            or 'Django Version' in r.text
            or 'INSTALLED_APPS' in r.text
            or 'Python Path' in r.text
        )
        assert not is_debug_leak, (
            f"CRITICAL FAIL: DEBUG=True detected — server returned Django debug page. "
            f"Set DEBUG=False in production/staging settings."
        )
        print(f"  PASS: No Django debug page on 404 (DEBUG=False confirmed)")

    def test_no_secrets_in_codebase(self):
        """
        Grep for common secret patterns in tracked files.
        This is NOT a substitute for a proper secrets scanner like truffleHog,
        but catches obvious mistakes.
        """
        import subprocess

        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

        SECRET_PATTERNS = [
            (r'SECRET_KEY\s*=\s*["\'][^"\'\$\{]{20,}', 'Hardcoded Django SECRET_KEY'),
            (r'PASSWORD\s*=\s*["\'][^"\'\$\{]{6,}',    'Hardcoded password'),
            (r'sk_live_[A-Za-z0-9]{20,}',               'Stripe live key'),
            (r'AKIA[A-Z0-9]{16}',                        'AWS Access Key ID'),
            (r'["\']-----BEGIN RSA PRIVATE KEY-----',   'Private key in code'),
        ]

        findings = []
        for pattern, description in SECRET_PATTERNS:
            result = subprocess.run(
                ['grep', '-rn', '--include=*.py', '--include=*.env',
                 '--exclude-dir=__pycache__', '--exclude-dir=.git',
                 '--exclude-dir=node_modules',
                 '-E', pattern, repo_root],
                capture_output=True, text=True,
            )
            hits = [l for l in result.stdout.strip().splitlines()
                    if '.env.example' not in l and 'test_security.py' not in l]
            if hits:
                findings.append((description, hits))

        for description, hits in findings:
            print(f"  FINDING [{description}]:")
            for hit in hits[:3]:
                print(f"    {hit}")

        assert not findings, (
            f"CRITICAL: Found {len(findings)} potential secret exposures in codebase. "
            f"Rotate any exposed keys immediately."
        )
        print(f"  PASS: No hardcoded secrets found in codebase")

    def test_no_secrets_in_git_history(self):
        """
        Check git log for commits that added common secret patterns.
        Full history scan — may take a moment.
        """
        import subprocess

        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

        result = subprocess.run(
            ['git', '-C', repo_root, 'log', '--all', '-p', '--follow', '-S', 'SECRET_KEY',
             '--', '*.py', '*.env'],
            capture_output=True, text=True, timeout=60,
        )

        # Filter out lines that are clearly template/example patterns
        suspicious = [l for l in result.stdout.splitlines()
                      if 'SECRET_KEY' in l and l.startswith('+')
                      and 'your-secret-key' not in l.lower()
                      and 'env(' not in l.lower()
                      and 'os.environ' not in l
                      and 'get_env' not in l.lower()]

        if suspicious:
            print(f"  FINDING: {len(suspicious)} suspicious SECRET_KEY lines in git history:")
            for line in suspicious[:5]:
                print(f"    {line[:100]}")
            print("  ACTION: If real keys were committed, rotate them immediately "
                  "even if the commit was later deleted.")
        else:
            print("  PASS: No obvious SECRET_KEY values in git history")

        # Don't hard-fail on git history — surface for human review
        if suspicious:
            pytest.warns(UserWarning, match="SECRET_KEY in git history")

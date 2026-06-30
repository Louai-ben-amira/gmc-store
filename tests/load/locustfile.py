"""
GMC Store — Locust Load Test (Category 3)

Simulates realistic user behavior at increasing concurrent user counts.
Records response times, error rates, and endpoint-level performance.

Usage:
  cd tests/load
  locust -f locustfile.py --host=http://your-staging-server.com/api

  # Headless mode (recommended for CI):
  locust -f locustfile.py --host=http://your-staging-server.com/api \
         --users 50 --spawn-rate 5 --run-time 2m --headless \
         --html=report_50users.html --csv=results_50users

Run progressively:
  20 users:  --users 20 --spawn-rate 2 --run-time 2m
  50 users:  --users 50 --spawn-rate 5 --run-time 3m
  100 users: --users 100 --spawn-rate 10 --run-time 5m

Install: pip install locust
"""
import random
import logging
import os
from locust import HttpUser, task, between, events
from locust.env import Environment

logger = logging.getLogger(__name__)

# ── Test credentials ──────────────────────────────────────────────────────
# Pre-create these accounts on staging before running the load test.
# Use run_all.py --setup-load-users to create them automatically.

TEST_USERS = [
    {'username': f'gmc_t_load{i:03d}', 'password': os.getenv('TEST_USER_PASS', 'GMCtest9999!')}
    for i in range(100)
]

# ── Realistic product IDs ─────────────────────────────────────────────────
# Update these to real product IDs on your staging server
SAMPLE_PRODUCT_IDS = list(range(1, 20))  # Will be populated on start if empty


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main user behaviour
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class GMCStoreUser(HttpUser):
    """
    Realistic user session:
    - Browses shop (most frequent)
    - Checks wallet (moderately frequent)
    - Views specific products (moderately frequent)
    - Places orders (rare — needs real balance)
    - Sends chat messages (rare)

    task weights approximate real user behaviour.
    """
    wait_time = between(1, 5)  # Realistic pause between actions (seconds)

    def on_start(self):
        """Log in when a simulated user starts their session."""
        user = random.choice(TEST_USERS)
        self._username = user['username']
        with self.client.post(
            '/auth/login/',
            json={'username': user['username'], 'password': user['password']},
            catch_response=True,
            name='POST /auth/login/',
        ) as resp:
            if resp.status_code == 200:
                token = resp.json().get('access', '')
                self.client.headers['Authorization'] = f'Bearer {token}'
                resp.success()
            else:
                resp.failure(f'Login failed: {resp.status_code}')
                self.client.headers.pop('Authorization', None)

    # ── High-frequency: browsing ─────────────────────────────────────────

    @task(8)
    def browse_shop(self):
        """Browse product list — most common action."""
        self.client.get('/products/', name='GET /products/ (list)')

    @task(5)
    def browse_shop_with_filter(self):
        """Filter products by category."""
        categories = ['steam', 'valorant', 'pubg', 'free-fire', 'playstation']
        cat = random.choice(categories)
        self.client.get(f'/products/?category={cat}', name='GET /products/ (filtered)')

    @task(4)
    def view_product_detail(self):
        """View a specific product page."""
        if not SAMPLE_PRODUCT_IDS:
            return
        pid = random.choice(SAMPLE_PRODUCT_IDS)
        self.client.get(f'/products/{pid}/', name='GET /products/:id/')

    # ── Medium-frequency: account actions ────────────────────────────────

    @task(3)
    def check_wallet(self):
        self.client.get('/wallet/', name='GET /wallet/')

    @task(2)
    def check_orders(self):
        self.client.get('/orders/', name='GET /orders/')

    @task(2)
    def check_wallet_transactions(self):
        self.client.get('/wallet/transactions/', name='GET /wallet/transactions/')

    @task(1)
    def check_me(self):
        self.client.get('/auth/me/', name='GET /auth/me/')

    # ── Low-frequency: purchases ──────────────────────────────────────────

    @task(1)
    def attempt_order(self):
        """
        Attempt a purchase — will fail with insufficient balance for most test users
        (which is realistic: not every visit leads to a purchase).
        We track the attempt regardless — confirms the endpoint handles load correctly.
        """
        if not SAMPLE_PRODUCT_IDS:
            return
        pid = random.choice(SAMPLE_PRODUCT_IDS)
        with self.client.post(
            '/orders/',
            json={'product_id': pid},
            catch_response=True,
            name='POST /orders/',
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            elif resp.status_code == 400:
                # "Insufficient balance" is expected for most test users
                resp.success()  # Not a server error
            else:
                resp.failure(f'Unexpected order response: {resp.status_code}')

    @task(1)
    def validate_promo(self):
        """Validate a promo code — common for users with discount codes."""
        fake_promos = ['SAVE10', 'GMC2024', 'WELCOME', 'INVALID']
        self.client.post(
            '/orders/validate-promo/',
            json={'code': random.choice(fake_promos), 'price': '20.00'},
            name='POST /orders/validate-promo/',
        )

    # ── Low-frequency: chat ───────────────────────────────────────────────

    @task(1)
    def send_chat_message(self):
        """Send a chat message — simulates support requests."""
        self.client.post(
            '/chat/messages/',
            json={'body': 'Test load message from gmc_t_load user'},
            name='POST /chat/messages/',
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Admin user (1 per 20 regular users)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class GMCAdminUser(HttpUser):
    """
    Simulates admin checking the dashboard while regular users browse.
    Use fixed_count=1 or weight=5 in Locust to keep admin sessions rare.
    """
    weight    = 5
    wait_time = between(3, 10)

    def on_start(self):
        admin_user = os.getenv('TEST_ADMIN_USER', 'admin')
        admin_pass = os.getenv('TEST_ADMIN_PASS', 'Admin1234!')
        with self.client.post(
            '/auth/login/',
            json={'username': admin_user, 'password': admin_pass},
            catch_response=True,
            name='POST /auth/login/ (admin)',
        ) as resp:
            if resp.status_code == 200:
                token = resp.json().get('access', '')
                self.client.headers['Authorization'] = f'Bearer {token}'
                resp.success()
            else:
                resp.failure(f'Admin login failed: {resp.status_code}')

    @task(3)
    def dashboard_stats(self):
        self.client.get('/admin/stats/', name='GET /admin/stats/')

    @task(2)
    def admin_orders(self):
        self.client.get('/admin/orders/', name='GET /admin/orders/')

    @task(1)
    def admin_users(self):
        self.client.get('/admin/users/', name='GET /admin/users/')

    @task(1)
    def admin_recharges(self):
        self.client.get('/payments/admin/recharges/', name='GET /payments/admin/recharges/')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Locust event hooks — print summary thresholds
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """
    After test run, print pass/fail assessment against performance targets.
    Targets for a CPX22 VPS (2 vCPU / 4 GB RAM):
      - Avg response time < 400ms for all endpoints
      - p95 response time < 1200ms
      - Error rate < 2%
    """
    stats = environment.stats
    total = stats.total

    if not total.num_requests:
        return

    avg_ms  = total.avg_response_time
    p95_ms  = total.get_response_time_percentile(0.95) or 0
    err_pct = (total.num_failures / total.num_requests * 100) if total.num_requests else 0

    print('\n' + '─' * 60)
    print('LOAD TEST SUMMARY')
    print('─' * 60)
    print(f'  Total requests : {total.num_requests}')
    print(f'  Failures       : {total.num_failures} ({err_pct:.1f}%)')
    print(f'  Avg response   : {avg_ms:.0f}ms  (target < 400ms)')
    print(f'  p95 response   : {p95_ms:.0f}ms  (target < 1200ms)')
    print(f'  RPS            : {total.current_rps:.1f}')

    passed = avg_ms < 400 and p95_ms < 1200 and err_pct < 2

    if passed:
        print('\n  RESULT: PASS — CPX22 handles this load within targets')
    else:
        print('\n  RESULT: FAIL — Performance outside targets:')
        if avg_ms >= 400:
            print(f'    avg {avg_ms:.0f}ms > 400ms target')
        if p95_ms >= 1200:
            print(f'    p95 {p95_ms:.0f}ms > 1200ms target')
        if err_pct >= 2:
            print(f'    error rate {err_pct:.1f}% > 2% target')
        print('    Consider: CPX32 (4 vCPU), Gunicorn worker tuning, or query optimization')
    print('─' * 60)

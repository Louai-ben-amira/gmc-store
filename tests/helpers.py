"""
GMC Store Test Suite — Shared helpers.
All API calls live here so tests stay readable.
"""
import time
import uuid
import threading
import requests
from decimal import Decimal
from config import (
    BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD,
    TEST_USER_PASSWORD, TEST_PREFIX, REQUEST_TIMEOUT,
    BARRIER_TIMEOUT, CONCURRENT_JOIN,
)


# ── Session factory ────────────────────────────────────────────────────────

def make_session(token=None):
    s = requests.Session()
    s.headers['Content-Type'] = 'application/json'
    if token:
        s.headers['Authorization'] = f'Bearer {token}'
    return s


# ── Auth ───────────────────────────────────────────────────────────────────

def get_token(username, password):
    """Login and return access token string. Raises on failure."""
    r = requests.post(
        f'{BASE_URL}/auth/login/',
        json={'username': username, 'password': password},
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code == 200, f'Login failed for {username}: {r.text}'
    return r.json()['access']


def get_admin_token():
    return get_token(ADMIN_USERNAME, ADMIN_PASSWORD)


# ── User management ─────────────────────────────────────────────────────────

def register_user(suffix=None, referral_code=None):
    """Register a fresh test user; return (username, token, user_id)."""
    uid = suffix or uuid.uuid4().hex[:8]
    username = f'{TEST_PREFIX}{uid}'
    email    = f'{username}@gmctest.local'
    payload  = {
        'username': username,
        'email':    email,
        'password': TEST_USER_PASSWORD,
    }
    if referral_code:
        payload['referral_code'] = referral_code

    r = requests.post(
        f'{BASE_URL}/auth/register/',
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code in (200, 201), f'Register failed: {r.text}'
    data = r.json()
    token = data.get('access') or get_token(username, TEST_USER_PASSWORD)
    # Fetch user id
    me_r  = make_session(token).get(f'{BASE_URL}/auth/me/', timeout=REQUEST_TIMEOUT)
    user_id = me_r.json()['id']
    return username, token, user_id


def set_user_balance(user_id, amount, admin_token=None):
    """Set user balance directly via admin API."""
    token = admin_token or get_admin_token()
    r = make_session(token).patch(
        f'{BASE_URL}/admin/users/{user_id}/',
        json={'balance': str(amount)},
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code in (200, 201), f'set_user_balance failed: {r.text}'


def get_user_info(user_id, admin_token=None):
    """Return admin view of user (has balance, etc.)."""
    token = admin_token or get_admin_token()
    r = make_session(token).get(
        f'{BASE_URL}/admin/users/{user_id}/',
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code == 200, f'get_user_info failed: {r.text}'
    return r.json()


def get_wallet_balance(user_token):
    """Return Decimal of user's current wallet balance."""
    r = make_session(user_token).get(f'{BASE_URL}/wallet/', timeout=REQUEST_TIMEOUT)
    assert r.status_code == 200, f'Wallet fetch failed: {r.text}'
    return Decimal(str(r.json()['balance']))


def get_referral_code(user_token):
    r = make_session(user_token).get(f'{BASE_URL}/wallet/referral/', timeout=REQUEST_TIMEOUT)
    assert r.status_code == 200
    return r.json().get('referral_code') or r.json().get('code')


# ── Gift cards ──────────────────────────────────────────────────────────────

def create_gift_card_batch(amount, quantity=1, admin_token=None):
    """
    Create a gift card batch via admin API.
    Returns list of code strings.
    """
    token = admin_token or get_admin_token()
    r = make_session(token).post(
        f'{BASE_URL}/payments/admin/gift-cards/',
        json={
            'amount':   str(amount),
            'quantity': quantity,
            'label':    f'{TEST_PREFIX}GiftCard_{amount}DT',
        },
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code in (200, 201), f'create_gift_card_batch failed: {r.text}'
    batch_id = r.json()['id']

    # Fetch the codes from the batch
    codes_r = make_session(token).get(
        f'{BASE_URL}/payments/admin/gift-cards/{batch_id}/codes/',
        timeout=REQUEST_TIMEOUT,
    )
    assert codes_r.status_code == 200, f'fetch gift card codes failed: {codes_r.text}'
    return [c['code'] for c in codes_r.json()]


def redeem_gift_card(user_token, code):
    """Redeem gift card. Return response object."""
    return make_session(user_token).post(
        f'{BASE_URL}/wallet/redeem/',
        json={'code': code},
        timeout=REQUEST_TIMEOUT,
    )


# ── Products & codes ────────────────────────────────────────────────────────

def create_product_with_codes(name, price, n_codes, admin_token=None):
    """
    Create a product and upload n_codes codes for it.
    Returns (product_id, [code_strings]).
    """
    token = admin_token or get_admin_token()
    sess  = make_session(token)

    # Create product
    prod_r = sess.post(
        f'{BASE_URL}/products/',
        json={
            'name':        name,
            'price':       str(price),
            'stock_count': n_codes,
            'visible':     True,
        },
        timeout=REQUEST_TIMEOUT,
    )
    assert prod_r.status_code in (200, 201), f'create_product failed: {prod_r.text}'
    product_id = prod_r.json()['id']

    # Upload codes
    codes = [f'CODE-{product_id}-{i:04d}' for i in range(n_codes)]
    codes_payload = '\n'.join(codes)
    upload_r = make_session(token).post(
        f'{BASE_URL}/products/{product_id}/codes/',
        json={'codes': codes_payload},
        timeout=REQUEST_TIMEOUT,
    )
    assert upload_r.status_code in (200, 201), f'upload_codes failed: {upload_r.text}'
    return product_id, codes


def place_order(user_token, product_id):
    """Place order for a product. Return response object."""
    return make_session(user_token).post(
        f'{BASE_URL}/orders/',
        json={'product_id': product_id},
        timeout=REQUEST_TIMEOUT,
    )


def get_wallet_transactions(user_token, method=None):
    """Return list of wallet transactions, optionally filtered by method."""
    r = make_session(user_token).get(f'{BASE_URL}/wallet/transactions/', timeout=REQUEST_TIMEOUT)
    assert r.status_code == 200
    txns = r.json()
    if isinstance(txns, dict):
        txns = txns.get('results', txns)
    if method:
        txns = [t for t in txns if t.get('method') == method]
    return txns


# ── Recharges ───────────────────────────────────────────────────────────────

def create_recharge_request(user_token, amount=20):
    """Submit a D17 recharge request. Returns (recharge_id, wallet_credit)."""
    r = make_session(user_token).post(
        f'{BASE_URL}/wallet/recharge/',
        json={'method': 'd17_address', 'amount_sent': str(amount)},
        timeout=REQUEST_TIMEOUT,
    )
    assert r.status_code in (200, 201), f'create_recharge_request failed: {r.text}'
    data = r.json()
    return data['id'], Decimal(str(data.get('wallet_credit', amount)))


def approve_recharge(recharge_id, admin_token=None):
    """Approve a recharge via admin endpoint. Return response."""
    token = admin_token or get_admin_token()
    return make_session(token).post(
        f'{BASE_URL}/payments/admin/recharges/{recharge_id}/approve/',
        json={'admin_note': 'auto-approved by test suite'},
        timeout=REQUEST_TIMEOUT,
    )


# ── Concurrency utility ──────────────────────────────────────────────────────

def fire_concurrent(callables):
    """
    Fire each callable in the list at exactly the same moment using a Barrier.
    Returns list of (result_or_exception) in the same order as input.
    All callables should be zero-argument lambdas.
    """
    n = len(callables)
    barrier = threading.Barrier(n, timeout=BARRIER_TIMEOUT)
    results = [None] * n

    def worker(i, fn):
        try:
            barrier.wait()   # All threads block here until every thread is ready
        except threading.BrokenBarrierError:
            results[i] = Exception('Barrier broken — thread sync failed')
            return
        try:
            results[i] = fn()
        except Exception as e:
            results[i] = e

    threads = [threading.Thread(target=worker, args=(i, fn)) for i, fn in enumerate(callables)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=CONCURRENT_JOIN)

    return results


# ── Cleanup ──────────────────────────────────────────────────────────────────

def cleanup_test_users(admin_token=None):
    """Delete all test users from the staging database via admin API. Returns count deleted."""
    token = admin_token or get_admin_token()
    r = make_session(token).get(
        f'{BASE_URL}/admin/users/?search={TEST_PREFIX}',
        timeout=REQUEST_TIMEOUT,
    )
    if r.status_code != 200:
        return 0
    users = r.json()
    if isinstance(users, dict):
        users = users.get('results', [])
    deleted = 0
    for u in users:
        if u['username'].startswith(TEST_PREFIX):
            dr = make_session(token).delete(
                f'{BASE_URL}/admin/users/{u["id"]}/',
                timeout=REQUEST_TIMEOUT,
            )
            if dr.status_code in (200, 204):
                deleted += 1
    return deleted

"""
GMC Store Test Suite — Category 1: Concurrency & Race Condition Tests

Every test fires many requests at exactly the same moment using a threading.Barrier
so all threads are alive and waiting before any of them fires.

Run: python -m pytest tests/concurrency/ -v   (from repo root)
  or: python tests/run_all.py
"""
import time
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from decimal import Decimal
from helpers import (
    get_admin_token, register_user, set_user_balance, get_user_info,
    get_wallet_balance, get_wallet_transactions, get_referral_code,
    create_gift_card_batch, redeem_gift_card,
    create_product_with_codes, place_order,
    create_recharge_request, approve_recharge,
    fire_concurrent, make_session,
)
from config import BASE_URL, REQUEST_TIMEOUT, REFERRAL_BONUS


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 1 — Gift Card Double-Redemption
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestGiftCardDoubleRedemption:
    """
    20 users fire redeem requests for the SAME code simultaneously.
    Expected: exactly 1 succeeds, 19 fail with "already redeemed".
    Validates: select_for_update() on GiftCard row in redeem_gift_card().
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_exactly_one_redemption_succeeds(self):
        N_USERS = 20
        CARD_AMOUNT = Decimal('10.00')

        # ── Setup ──────────────────────────────────────────────────────────
        codes = create_gift_card_batch(CARD_AMOUNT, quantity=1, admin_token=self.admin_token)
        assert len(codes) == 1, "Expected 1 gift card code"
        code = codes[0]

        # Create 20 test users, each with 0 balance (balance doesn't matter for gift card)
        users = [register_user(suffix=f'gc{i:02d}') for i in range(N_USERS)]
        tokens = [u[1] for u in users]

        # ── Fire all 20 redeem requests simultaneously ──────────────────────
        callables = [lambda tok=tok: redeem_gift_card(tok, code) for tok in tokens]
        responses = fire_concurrent(callables)

        # ── Assertions ─────────────────────────────────────────────────────
        status_codes  = [r.status_code if hasattr(r, 'status_code') else 500 for r in responses]
        successes     = [sc for sc in status_codes if sc == 200]
        failures      = [sc for sc in status_codes if sc != 200]

        assert len(successes) == 1, (
            f"FAIL: Expected exactly 1 success, got {len(successes)}. "
            f"Status codes: {sorted(status_codes)}"
        )
        assert len(failures) == N_USERS - 1, (
            f"FAIL: Expected {N_USERS-1} failures, got {len(failures)}"
        )

        # ── DB verification via API ────────────────────────────────────────
        # Find which user succeeded and verify their balance increased
        winner_idx = next(i for i, r in enumerate(responses)
                          if hasattr(r, 'status_code') and r.status_code == 200)
        winner_token = tokens[winner_idx]
        winner_balance = get_wallet_balance(winner_token)
        assert winner_balance == CARD_AMOUNT, (
            f"FAIL: Winner balance should be {CARD_AMOUNT}, got {winner_balance}"
        )

        # Verify all other users have 0 balance
        for i, tok in enumerate(tokens):
            if i == winner_idx:
                continue
            bal = get_wallet_balance(tok)
            assert bal == Decimal('0'), (
                f"FAIL: User {i} should have 0 balance but has {bal} — double-credit detected"
            )

        print(f"  PASS: 1 redemption succeeded, {N_USERS-1} blocked. "
              f"Winner balance: {winner_balance} DT")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 2 — Wallet Balance Race (double-spend vulnerability check)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestWalletBalanceRace:
    """
    1 user with 10 DT fires 5 simultaneous purchase requests for a 5 DT product.
    Expected: exactly 2 succeed (10 / 5 = 2), final balance = 0.

    KNOWN RISK: The balance check in views.py line 314 is OUTSIDE transaction.atomic().
    Both threads could read balance=10, both pass the check, both deduct 5 →
    final balance 5 DT instead of 0, with 2 products delivered for the price of 1.
    If this test fails, the fix is: re-read user with select_for_update() inside atomic.
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_no_negative_balance_and_exact_purchase_count(self):
        N_ATTEMPTS = 5
        PRODUCT_PRICE = Decimal('5.00')
        STARTING_BALANCE = Decimal('10.00')
        EXPECTED_SUCCESSES = 2  # 10 / 5 = 2

        # ── Setup ──────────────────────────────────────────────────────────
        username, token, user_id = register_user(suffix='balance_race')
        set_user_balance(user_id, STARTING_BALANCE, admin_token=self.admin_token)

        # Product with 5 codes so stock isn't the limiting factor
        product_id, _ = create_product_with_codes(
            name=f'BalanceRaceTest_{user_id}',
            price=PRODUCT_PRICE,
            n_codes=5,
            admin_token=self.admin_token,
        )

        # ── Fire 5 simultaneous purchases from the same account ────────────
        callables = [lambda: place_order(token, product_id) for _ in range(N_ATTEMPTS)]
        responses = fire_concurrent(callables)

        # Wait for any async side effects (referral, email tasks)
        time.sleep(1)

        # ── Assertions ─────────────────────────────────────────────────────
        status_codes = [r.status_code if hasattr(r, 'status_code') else 500 for r in responses]
        successes    = [sc for sc in status_codes if sc in (200, 201)]
        final_balance = get_wallet_balance(token)

        # Balance must never go negative
        assert final_balance >= Decimal('0'), (
            f"CRITICAL FAIL: Balance went negative! Final: {final_balance} DT"
        )

        # Balance must reflect actual purchases (each purchase = 5 DT)
        # If there's a race condition, successes > 2 but balance = 5 (only 1 deducted)
        actual_deducted = STARTING_BALANCE - final_balance
        assert final_balance == EXPECTED_SUCCESSES * PRODUCT_PRICE or final_balance == Decimal('0'), \
            (f"Balance sanity check — starting: {STARTING_BALANCE}, "
             f"final: {final_balance}, deducted: {actual_deducted}")

        if len(successes) > EXPECTED_SUCCESSES:
            raise AssertionError(
                f"FAIL (double-spend detected): {len(successes)} purchases succeeded "
                f"but user only had {STARTING_BALANCE} DT for {PRODUCT_PRICE} DT items. "
                f"Final balance: {final_balance} DT (should be 0). "
                f"FIX: add select_for_update() on user row inside transaction.atomic() "
                f"in OrderListCreateView.create() before balance deduction."
            )

        print(f"  PASS: {len(successes)}/{N_ATTEMPTS} purchases succeeded. "
              f"Final balance: {final_balance} DT (started with {STARTING_BALANCE} DT)")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 3 — Stock Oversell
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestStockOversell:
    """
    Product with exactly 3 codes. 10 users (each with sufficient balance)
    fire purchase requests simultaneously.
    Expected: exactly 3 succeed, 7 fail, no code delivered twice.
    Validates: select_for_update() on Code rows in OrderListCreateView.
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_never_oversell_stock(self):
        N_CODES  = 3
        N_USERS  = 10
        PRICE    = Decimal('5.00')
        BALANCE  = Decimal('10.00')

        # ── Setup ──────────────────────────────────────────────────────────
        product_id, code_strings = create_product_with_codes(
            name=f'OversellTest',
            price=PRICE,
            n_codes=N_CODES,
            admin_token=self.admin_token,
        )

        users = [register_user(suffix=f'os{i:02d}') for i in range(N_USERS)]
        for (_, _, uid) in users:
            set_user_balance(uid, BALANCE, admin_token=self.admin_token)
        tokens = [u[1] for u in users]

        # ── Fire 10 simultaneous purchases ─────────────────────────────────
        callables = [lambda tok=tok: place_order(tok, product_id) for tok in tokens]
        responses = fire_concurrent(callables)

        # ── Assertions ─────────────────────────────────────────────────────
        status_codes = [r.status_code if hasattr(r, 'status_code') else 500 for r in responses]
        successes    = [(i, r) for i, r in enumerate(responses)
                        if hasattr(r, 'status_code') and r.status_code in (200, 201)]
        failures     = [r for r in responses
                        if hasattr(r, 'status_code') and r.status_code not in (200, 201)]

        assert len(successes) == N_CODES, (
            f"FAIL: Expected exactly {N_CODES} successes (= stock), "
            f"got {len(successes)}. Status codes: {sorted(status_codes)}"
        )
        assert len(failures) == N_USERS - N_CODES

        # Verify no code was delivered twice
        delivered_codes = []
        for idx, resp in successes:
            order_data = resp.json()
            # code_value will be None until revealed — check order was created
            order_id = order_data.get('id')
            assert order_id, f"Success response missing order id: {order_data}"

            # Reveal the code to check for uniqueness
            reveal_r = make_session(tokens[idx]).post(
                f'{BASE_URL}/orders/{order_id}/reveal-code/',
                timeout=REQUEST_TIMEOUT,
            )
            if reveal_r.status_code == 200:
                code_val = reveal_r.json().get('code')
                assert code_val not in delivered_codes, (
                    f"CRITICAL FAIL: code '{code_val}' delivered to two different users!"
                )
                delivered_codes.append(code_val)

        assert len(delivered_codes) == N_CODES, (
            f"Could only verify {len(delivered_codes)} codes — expected {N_CODES}"
        )

        print(f"  PASS: {N_CODES} orders succeeded with {N_CODES} unique codes. "
              f"{len(failures)} requests correctly rejected.")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 4 — Referral Bonus Double-Credit
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestReferralDoubleCredit:
    """
    Referred user places many orders simultaneously.
    handle_referral_first_purchase() fires in daemon threads for each order.
    Expected: referrer receives bonus EXACTLY ONCE (2.00 DT), never multiple times.

    KNOWN RISK: referral.py reads ReferralBonus without select_for_update().
    Multiple daemon threads could all see was_eligible=False and all credit.
    If this test fails, add select_for_update() in handle_referral_first_purchase().
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_referral_bonus_credited_exactly_once(self):
        N_ORDERS = 5
        PRODUCT_PRICE = Decimal('0.01')  # Cheap so user can afford many

        # ── Setup ──────────────────────────────────────────────────────────
        # Register referrer
        referrer_username, referrer_token, referrer_id = register_user(suffix='ref_er')
        set_user_balance(referrer_id, Decimal('5.00'), admin_token=self.admin_token)
        referrer_code = get_referral_code(referrer_token)
        assert referrer_code, "Could not fetch referral code"
        referrer_balance_before = get_wallet_balance(referrer_token)

        # Register referred user with referrer's code
        _, referred_token, referred_id = register_user(
            suffix='ref_ed', referral_code=referrer_code
        )
        set_user_balance(referred_id, Decimal('1.00'), admin_token=self.admin_token)

        # Product with many cheap codes
        product_id, _ = create_product_with_codes(
            name='ReferralTest_Product',
            price=PRODUCT_PRICE,
            n_codes=N_ORDERS + 2,
            admin_token=self.admin_token,
        )

        # ── Fire many simultaneous orders from the referred user ────────────
        callables = [lambda: place_order(referred_token, product_id) for _ in range(N_ORDERS)]
        responses = fire_concurrent(callables)

        # Wait for all daemon threads (handle_referral_first_purchase) to settle
        time.sleep(3)

        # ── Assertions ─────────────────────────────────────────────────────
        referrer_balance_after = get_wallet_balance(referrer_token)
        bonus_received = referrer_balance_after - referrer_balance_before

        assert bonus_received == Decimal(str(REFERRAL_BONUS)), (
            f"FAIL: Referrer should receive exactly {REFERRAL_BONUS} DT bonus, "
            f"but received {bonus_received} DT. "
            f"Before: {referrer_balance_before}, After: {referrer_balance_after}. "
            f"FIX: Add select_for_update() when fetching ReferralBonus in "
            f"handle_referral_first_purchase() in apps/users/referral.py"
        )

        # Verify via wallet transactions: only 1 referral credit
        txns = get_wallet_transactions(referrer_token, method='referral')
        assert len(txns) == 1, (
            f"FAIL: Expected 1 referral transaction, found {len(txns)}. "
            f"Double-credit via multiple daemon threads."
        )

        print(f"  PASS: Referral bonus credited exactly once ({bonus_received} DT). "
              f"Referral transactions: {len(txns)}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST 5 — Recharge Approval Double-Processing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestRechargeDoubleApproval:
    """
    1 pending recharge. 5 admin threads fire approve simultaneously.
    Expected: balance credited EXACTLY ONCE, exactly 1 WalletTransaction created.
    Validates: status != 'pending' guard in admin_recharge_approve() acts as idempotency.

    NOTE: The current guard uses a non-locked status check — could race.
    The fix would be: select_for_update() on the RechargeRequest row.
    """

    def setup_method(self):
        self.admin_token = get_admin_token()

    def test_recharge_approved_exactly_once(self):
        N_APPROVERS = 5
        RECHARGE_AMOUNT = Decimal('20.00')

        # ── Setup ──────────────────────────────────────────────────────────
        _, user_token, user_id = register_user(suffix='recharge_race')
        balance_before = get_wallet_balance(user_token)

        recharge_id, wallet_credit = create_recharge_request(
            user_token, amount=float(RECHARGE_AMOUNT)
        )

        # ── Fire 5 simultaneous approve requests ───────────────────────────
        callables = [
            lambda: approve_recharge(recharge_id, admin_token=self.admin_token)
            for _ in range(N_APPROVERS)
        ]
        responses = fire_concurrent(callables)

        # ── Assertions ─────────────────────────────────────────────────────
        status_codes = [r.status_code if hasattr(r, 'status_code') else 500 for r in responses]
        successes    = [sc for sc in status_codes if sc == 200]
        duplicates   = len(successes) - 1  # anything beyond 1 success is a double-credit

        balance_after   = get_wallet_balance(user_token)
        balance_credited = balance_after - balance_before

        assert balance_credited == wallet_credit, (
            f"FAIL: Balance should be credited exactly {wallet_credit} DT once. "
            f"Credited: {balance_credited} DT ({len(successes)} approve requests succeeded). "
            f"FIX: Add select_for_update() on RechargeRequest in admin_recharge_approve(). "
            f"Status codes from 5 concurrent approves: {sorted(status_codes)}"
        )

        assert len(successes) == 1 or (
            len(successes) > 1 and balance_credited == wallet_credit
        ), (
            f"WARNING: {len(successes)} approve calls returned 200, but balance "
            f"only credited once — the guard worked but returned misleading responses."
        )

        # Verify via wallet transactions: only 1 recharge credit
        txns = get_wallet_transactions(user_token)
        recharge_txns = [t for t in txns if t.get('method') in
                         ('d17_address', 'd17', 'recharge')]
        assert len(recharge_txns) == 1, (
            f"FAIL: Expected 1 recharge WalletTransaction, found {len(recharge_txns)}. "
            f"All transactions: {[t.get('method') for t in txns]}"
        )

        print(f"  PASS: Recharge credited exactly once ({balance_credited} DT). "
              f"Approve responses: {sorted(status_codes)}")

"""
GMC Store — WebSocket / Chat Load Test

Simulates 30-50 concurrent WebSocket connections sending and receiving messages.
Validates that Redis channel layer handles concurrent connections correctly
and that messages are delivered in real-time without drops.

Usage:
  python tests/load/ws_load.py --url ws://your-staging.com/ws/chat/ \
                                --users 30 --duration 60

Install: pip install websockets
"""
import asyncio
import argparse
import json
import time
import os
import sys
import statistics
import requests
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import websockets
except ImportError:
    print("Install websockets: pip install websockets")
    sys.exit(1)

from config import BASE_URL, TEST_USER_PASSWORD, TEST_PREFIX


def get_token(username, password):
    r = requests.post(
        f'{BASE_URL}/auth/login/',
        json={'username': username, 'password': password},
        timeout=10,
    )
    if r.status_code == 200:
        return r.json()['access']
    return None


async def ws_client(user_id, ws_url, token, duration, results):
    """
    Single WebSocket client:
    - Connects with JWT token
    - Sends a message every 3 seconds
    - Records which messages it receives back
    - Counts drops (sent but never echoed)
    """
    sent     = 0
    received = 0
    latencies = []

    # Append token to URL for Django Channels auth
    url = f'{ws_url}?token={token}'

    try:
        async with websockets.connect(url, open_timeout=10) as ws:
            end_time = time.time() + duration
            pending = {}

            async def send_loop():
                nonlocal sent
                while time.time() < end_time:
                    msg_id = f'{user_id}_{sent}'
                    payload = json.dumps({
                        'type': 'chat_message',
                        'body': f'Load test message {msg_id}',
                        'msg_id': msg_id,
                    })
                    pending[msg_id] = time.time()
                    await ws.send(payload)
                    sent += 1
                    await asyncio.sleep(3)

            async def recv_loop():
                nonlocal received
                while time.time() < end_time:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                        msg = json.loads(raw)
                        msg_id = msg.get('msg_id') or msg.get('id')
                        if msg_id in pending:
                            latency = (time.time() - pending.pop(msg_id)) * 1000
                            latencies.append(latency)
                            received += 1
                    except asyncio.TimeoutError:
                        pass
                    except Exception:
                        break

            await asyncio.gather(send_loop(), recv_loop())

    except Exception as e:
        results.append({
            'user_id': user_id,
            'error': str(e),
            'sent': sent,
            'received': received,
            'latencies': latencies,
        })
        return

    results.append({
        'user_id': user_id,
        'error': None,
        'sent': sent,
        'received': received,
        'latencies': latencies,
        'drop_rate': (sent - received) / sent if sent > 0 else 0,
    })


async def run_ws_load_test(ws_url, n_users, duration, tokens):
    """Run all WebSocket clients concurrently."""
    results = []
    tasks   = []

    # Start all clients within 2 seconds (simulate concurrent connections)
    for i, token in enumerate(tokens[:n_users]):
        tasks.append(ws_client(i, ws_url, token, duration, results))

    await asyncio.gather(*tasks)
    return results


def main():
    parser = argparse.ArgumentParser(description='GMC Store WebSocket Load Test')
    parser.add_argument('--url',      default='ws://localhost:8000/ws/chat/',
                        help='WebSocket URL')
    parser.add_argument('--users',    type=int, default=30,
                        help='Number of concurrent WebSocket connections')
    parser.add_argument('--duration', type=int, default=60,
                        help='Duration of test in seconds')
    args = parser.parse_args()

    print(f"GMC Store WebSocket Load Test")
    print(f"URL: {args.url}")
    print(f"Concurrent connections: {args.users}")
    print(f"Duration: {args.duration}s")
    print()

    # Get tokens for test users
    print("Authenticating test users...")
    tokens = []
    for i in range(args.users):
        username = f'{TEST_PREFIX}load{i:03d}'
        token = get_token(username, TEST_USER_PASSWORD)
        if token:
            tokens.append(token)

    if not tokens:
        print("ERROR: Could not authenticate any test users.")
        print(f"Run: python tests/run_all.py --setup-load-users first")
        sys.exit(1)

    actual_users = min(args.users, len(tokens))
    print(f"Authenticated {actual_users} users. Starting connections...")
    print()

    # Run the test
    start = time.time()
    results = asyncio.run(run_ws_load_test(args.url, actual_users, args.duration, tokens))
    elapsed = time.time() - start

    # ── Analysis ───────────────────────────────────────────────────────────
    connected     = [r for r in results if r.get('error') is None]
    failed_conn   = [r for r in results if r.get('error') is not None]
    total_sent     = sum(r['sent'] for r in results)
    total_received = sum(r['received'] for r in results)
    all_latencies  = [l for r in connected for l in r.get('latencies', [])]

    print('─' * 60)
    print('WEBSOCKET LOAD TEST RESULTS')
    print('─' * 60)
    print(f'  Duration          : {elapsed:.1f}s')
    print(f'  Connections OK    : {len(connected)}/{actual_users}')
    print(f'  Connection errors : {len(failed_conn)}')
    print(f'  Messages sent     : {total_sent}')
    print(f'  Messages received : {total_received}')

    drop_count = total_sent - total_received
    drop_pct   = drop_count / total_sent * 100 if total_sent > 0 else 0
    print(f'  Dropped messages  : {drop_count} ({drop_pct:.1f}%)')

    if all_latencies:
        avg_lat = statistics.mean(all_latencies)
        p95_lat = sorted(all_latencies)[int(len(all_latencies) * 0.95)]
        print(f'  Avg latency       : {avg_lat:.0f}ms')
        print(f'  p95 latency       : {p95_lat:.0f}ms')
    else:
        print(f'  Latency           : N/A (no echo-back messages received)')

    if failed_conn:
        print(f'\n  Connection errors:')
        for r in failed_conn[:5]:
            print(f"    User {r['user_id']}: {r['error']}")

    # ── Pass/Fail judgment ─────────────────────────────────────────────────
    print()
    conn_rate = len(connected) / actual_users * 100
    passed = (
        conn_rate >= 95           # 95%+ of connections must succeed
        and drop_pct < 5          # < 5% message drop rate
        and (not all_latencies or avg_lat < 500)  # avg latency < 500ms
    )

    if passed:
        print('  RESULT: PASS — Redis channel layer handles concurrent WebSocket load')
    else:
        print('  RESULT: FAIL:')
        if conn_rate < 95:
            print(f'    Connection rate {conn_rate:.0f}% < 95% — check ASGI/Channels config')
        if drop_pct >= 5:
            print(f'    Drop rate {drop_pct:.0f}% ≥ 5% — Redis channel layer dropping messages')
        if all_latencies and avg_lat >= 500:
            print(f'    Avg latency {avg_lat:.0f}ms ≥ 500ms — Redis or server under stress')

    print('─' * 60)


if __name__ == '__main__':
    main()

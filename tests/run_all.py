"""
GMC Store — Test Suite Orchestrator

Runs Category 1 (concurrency) and Category 2 (security) tests and produces
a structured PASS/FAIL report. Category 3 (load) is run separately via Locust.

Usage:
  python tests/run_all.py                    # Run categories 1 and 2
  python tests/run_all.py --cat 1            # Concurrency only
  python tests/run_all.py --cat 2            # Security only
  python tests/run_all.py --cleanup          # Clean up test users and exit
  python tests/run_all.py --setup-load-users # Create 100 load test users

Requirements:
  pip install -r tests/requirements.txt
  Backend must be running and BASE_URL/ADMIN_* in tests/config.py must be set.
"""
import sys
import os
import argparse
import time
import subprocess
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from config import BASE_URL, ADMIN_USER, ADMIN_PASS, TEST_USER_PASSWORD, TEST_PREFIX
from helpers import get_admin_token, register_user, set_user_balance, cleanup_test_users


def run_pytest_category(path, name):
    """Run pytest on a directory, capture output, return (passed, failed, output)."""
    result = subprocess.run(
        [sys.executable, '-m', 'pytest', path, '-v', '--tb=short',
         '--no-header', '-q'],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(__file__)),
    )
    output = result.stdout + result.stderr

    # Parse pytest summary line
    passed = 0
    failed = 0
    errors = 0
    for line in output.splitlines():
        if ' passed' in line:
            parts = line.split()
            for i, part in enumerate(parts):
                if part == 'passed':
                    try:
                        passed = int(parts[i-1])
                    except (IndexError, ValueError):
                        pass
                if part == 'failed':
                    try:
                        failed = int(parts[i-1])
                    except (IndexError, ValueError):
                        pass
                if part == 'error' in part:
                    errors += 1

    return passed, failed, output


def print_report(results, start_time):
    """Print structured PASS/FAIL report."""
    elapsed = time.time() - start_time
    now     = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    print()
    print('═' * 70)
    print('  GMC STORE — TEST SUITE REPORT')
    print(f'  Run at: {now}')
    print(f'  Elapsed: {elapsed:.1f}s')
    print('═' * 70)

    all_pass = True
    for cat_name, passed, failed, output in results:
        status = 'PASS' if failed == 0 else 'FAIL'
        if failed > 0:
            all_pass = False
        print(f'\n  [{status}] {cat_name}')
        print(f'         {passed} passed, {failed} failed')

        # Extract individual test names + status from pytest -v output
        for line in output.splitlines():
            if '::test_' in line or '::Test' in line:
                if ' PASSED' in line:
                    test_name = line.split('::')[-1].split(' ')[0]
                    print(f'           ✓ {test_name}')
                elif ' FAILED' in line or ' ERROR' in line:
                    test_name = line.split('::')[-1].split(' ')[0]
                    print(f'           ✗ {test_name}')
                elif ' SKIPPED' in line:
                    test_name = line.split('::')[-1].split(' ')[0]
                    print(f'           - {test_name} (skipped)')

    print()
    print('─' * 70)
    if all_pass:
        print('  OVERALL: PASS — All launch-blocker tests passed')
    else:
        print('  OVERALL: FAIL — Fix failures before launch')
        print()
        print('  Launch blockers:')
        for cat_name, passed, failed, output in results:
            if failed > 0:
                print(f'    • {cat_name}: {failed} test(s) failed')
    print('─' * 70)

    # Show failure details
    for cat_name, passed, failed, output in results:
        if failed > 0:
            print(f'\n  FAILURES in {cat_name}:')
            in_failure = False
            for line in output.splitlines():
                if line.startswith('FAILED') or 'AssertionError' in line or '_ FAILED _' in line:
                    in_failure = True
                if in_failure:
                    print(f'    {line}')
                if in_failure and line == '':
                    in_failure = False

    # Save JSON report
    report_path = os.path.join(os.path.dirname(__file__), 'last_report.json')
    report_data = {
        'run_at': now,
        'elapsed_seconds': elapsed,
        'overall': 'PASS' if all_pass else 'FAIL',
        'categories': [
            {'name': n, 'passed': p, 'failed': f}
            for n, p, f, _ in results
        ],
    }
    with open(report_path, 'w') as fp:
        json.dump(report_data, fp, indent=2)
    print(f'\n  Report saved: {report_path}')


def setup_load_users(admin_token, n=100):
    """Create 100 test users for Locust load testing."""
    print(f'Creating {n} load test users (prefix: {TEST_PREFIX}load)...')
    created = 0
    for i in range(n):
        suffix = f'load{i:03d}'
        try:
            _, _, uid = register_user(suffix=suffix)
            set_user_balance(uid, amount=100, admin_token=admin_token)
            created += 1
            if (i + 1) % 10 == 0:
                print(f'  {i+1}/{n} created...')
        except Exception as e:
            print(f'  Skip {suffix}: {e}')
    print(f'Done. {created} load test users ready.')
    print(f'Now run: locust -f tests/load/locustfile.py --host={BASE_URL.rsplit("/api", 1)[0]}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cat',              type=int, choices=[1, 2],
                        help='Run only category 1 or 2')
    parser.add_argument('--cleanup',          action='store_true',
                        help='Delete all gmc_t_ test users and exit')
    parser.add_argument('--setup-load-users', action='store_true',
                        help='Create 100 Locust load test users')
    args = parser.parse_args()

    # Verify backend is reachable
    import requests
    try:
        r = requests.get(f'{BASE_URL}/products/', timeout=5)
        print(f'Backend: {BASE_URL} ({r.status_code})')
    except Exception as e:
        print(f'ERROR: Cannot reach backend at {BASE_URL}')
        print(f'       {e}')
        print(f'       Start the backend first, then re-run.')
        sys.exit(1)

    admin_token = get_admin_token()
    print(f'Admin token: OK')

    if args.cleanup:
        print('Cleaning up test users...')
        deleted = cleanup_test_users(admin_token)
        print(f'Deleted {deleted} test accounts.')
        return

    if args.setup_load_users:
        setup_load_users(admin_token)
        return

    start_time = time.time()
    results    = []

    base_dir = os.path.dirname(__file__)

    # Category 1: Concurrency
    if args.cat in (None, 1):
        print(f'\nRunning Category 1 — Concurrency & Race Conditions...')
        passed, failed, output = run_pytest_category(
            os.path.join(base_dir, 'concurrency'),
            'Category 1: Concurrency',
        )
        results.append(('Category 1: Concurrency (5 tests)', passed, failed, output))

    # Category 2: Security
    if args.cat in (None, 2):
        print(f'Running Category 2 — Security...')
        passed, failed, output = run_pytest_category(
            os.path.join(base_dir, 'security'),
            'Category 2: Security',
        )
        results.append(('Category 2: Security (7 tests)', passed, failed, output))

    print_report(results, start_time)

    # Cleanup test users created during this run
    print('\nCleaning up test users from this run...')
    try:
        deleted = cleanup_test_users(admin_token)
        print(f'Cleaned up {deleted} test accounts.')
    except Exception as e:
        print(f'Cleanup failed (manual cleanup needed): {e}')

    # Exit 1 if any failures (for CI)
    has_failures = any(f > 0 for _, _, f, _ in results)
    sys.exit(1 if has_failures else 0)


if __name__ == '__main__':
    main()

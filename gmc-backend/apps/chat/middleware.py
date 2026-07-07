"""Opportunistic trigger for the unread-message email sweep.

Production has no Celery worker or cron, so background checks piggyback on
normal request traffic: each request cheaply attempts an atomic cache lock;
at most one request per SWEEP_INTERVAL actually spawns the sweep thread.
"""
from apps.chat.tasks import start_sweep_if_due


class UnreadEmailSweepMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            start_sweep_if_due()
        except Exception:
            pass
        return self.get_response(request)

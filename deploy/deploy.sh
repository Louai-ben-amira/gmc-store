#!/bin/bash
# GMC Store — production deploy script
# Run from the server as your deploy user.
# Usage: ./deploy.sh

set -euo pipefail

BACKEND_DIR="/home/youruser/gmc-backend"
FRONTEND_DIR="/home/youruser/gmc-frontend"

echo "==> Pulling latest code"
git -C "$BACKEND_DIR"  pull --ff-only
git -C "$FRONTEND_DIR" pull --ff-only

# ── Backend ───────────────────────────────────────────────────────────────
echo "==> Installing Python dependencies"
"$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt" --quiet

echo "==> Running migrations"
"$BACKEND_DIR/venv/bin/python" "$BACKEND_DIR/manage.py" migrate --no-input

echo "==> Collecting static files"
"$BACKEND_DIR/venv/bin/python" "$BACKEND_DIR/manage.py" collectstatic --no-input --clear

# ── Frontend ──────────────────────────────────────────────────────────────
echo "==> Installing frontend dependencies"
npm --prefix "$FRONTEND_DIR" ci --silent

echo "==> Building frontend"
npm --prefix "$FRONTEND_DIR" run build

# ── Restart services ──────────────────────────────────────────────────────
echo "==> Restarting services"
sudo systemctl restart gmc-daphne
sudo systemctl restart gmc-celery
sudo systemctl restart gmc-celery-beat
sudo systemctl reload nginx

echo "==> Done. Check status:"
echo "    sudo systemctl status gmc-daphne gmc-celery gmc-celery-beat"

# GMC Store — VPS Production Setup

Run these commands once on a fresh Ubuntu 22.04 / 24.04 server.
Replace `youruser` and `yourdomain.com` everywhere.

## 1. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip \
    postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx \
    nodejs npm git
```

## 2. PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER gmcuser WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE gmc_store OWNER gmcuser;"
```

## 3. Clone repos & virtualenv

```bash
git clone https://github.com/Louai-ben-amira/gmc-backend.git  /home/youruser/gmc-backend
git clone https://github.com/Louai-ben-amira/gmc-frontend.git /home/youruser/gmc-frontend

python3.11 -m venv /home/youruser/gmc-backend/venv
/home/youruser/gmc-backend/venv/bin/pip install -r /home/youruser/gmc-backend/requirements.txt
```

## 4. Environment file

```bash
cp /home/youruser/gmc-backend/.env.example /home/youruser/gmc-backend/.env
nano /home/youruser/gmc-backend/.env
# Fill in: SECRET_KEY, DB_PASSWORD, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS,
#          EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, TELEGRAM_BOT_TOKEN, etc.
# Make sure: DEBUG=False
```

Generate a real SECRET_KEY:
```bash
/home/youruser/gmc-backend/venv/bin/python \
  -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## 5. Django setup

```bash
cd /home/youruser/gmc-backend
venv/bin/python manage.py migrate
venv/bin/python manage.py collectstatic --no-input
venv/bin/python manage.py createsuperuser
```

## 6. Frontend build

```bash
cd /home/youruser/gmc-frontend
# Edit .env — set VITE_API_URL=https://yourdomain.com/api
#             and VITE_WS_URL=wss://yourdomain.com
npm ci
npm run build
```

## 7. Systemd services

```bash
sudo cp /home/youruser/gmc-backend/../deploy/gmc-daphne.service     /etc/systemd/system/
sudo cp /home/youruser/gmc-backend/../deploy/gmc-celery.service      /etc/systemd/system/
sudo cp /home/youruser/gmc-backend/../deploy/gmc-celery-beat.service /etc/systemd/system/

# Replace youruser placeholder in all three files
sudo sed -i 's/youruser/ACTUALUSER/g' /etc/systemd/system/gmc-*.service

sudo systemctl daemon-reload
sudo systemctl enable  gmc-daphne gmc-celery gmc-celery-beat
sudo systemctl start   gmc-daphne gmc-celery gmc-celery-beat
sudo systemctl status  gmc-daphne
```

## 8. Nginx + SSL

```bash
# Replace youruser and yourdomain.com in nginx.conf first:
sudo cp /home/youruser/gmc-backend/../deploy/nginx.conf /etc/nginx/sites-available/gmcstore
sudo sed -i 's/youruser/ACTUALUSER/g'       /etc/nginx/sites-available/gmcstore
sudo sed -i 's/yourdomain.com/YOURDOMAIN/g' /etc/nginx/sites-available/gmcstore

sudo ln -s /etc/nginx/sites-available/gmcstore /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL certificate (free, auto-renewing)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 9. Redis security (basic)

```bash
# Bind Redis to localhost only (default on Ubuntu, verify)
grep "^bind" /etc/redis/redis.conf   # should show: bind 127.0.0.1 ::1
sudo systemctl restart redis
```

## 10. Test everything

```bash
# Django health
curl -I https://yourdomain.com/api/auth/me/
# Should get 401 (not 500, not connection refused)

# WebSocket — install wscat once: npm install -g wscat
wscat -c "wss://yourdomain.com/ws/chat/1/?token=YOURTOKEN"

# Email
/home/youruser/gmc-backend/venv/bin/python manage.py shell \
  -c "from django.core.mail import send_mail; send_mail('test','body','from@x.com',['to@x.com'])"

# Celery
/home/youruser/gmc-backend/venv/bin/celery -A config inspect active
```

## Deploy updates (after initial setup)

```bash
chmod +x /home/youruser/gmc-backend/../deploy/deploy.sh
./deploy/deploy.sh
```

Add to sudoers so deploy script can restart services without password:
```bash
sudo visudo
# Add this line (replace youruser):
youruser ALL=(ALL) NOPASSWD: /bin/systemctl restart gmc-daphne, /bin/systemctl restart gmc-celery, /bin/systemctl restart gmc-celery-beat, /bin/systemctl reload nginx
```

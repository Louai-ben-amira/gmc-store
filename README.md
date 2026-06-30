# GMC Store - Digital Goods Marketplace

A production-ready digital goods marketplace with Django backend and React frontend.

## Tech Stack

- **Backend:** Django 5 + Django REST Framework + Simple JWT
- **Realtime:** Django Channels + Redis
- **Queue:** Celery + Redis + Celery Beat
- **Admin:** Django Admin + django-jazzmin (dark theme)
- **Database:** PostgreSQL 16+
- **Frontend:** React 18 + Vite + React Router v7
- **State:** Zustand
- **Data Fetching:** TanStack Query (react-query)
- **Styling:** Tailwind CSS v4 (dark mode)
- **HTTP:** Axios with JWT interceptor (auto-refresh)
- **WebSocket:** Django Channels for real-time chat

---

## Backend Setup

```bash
cd gmc-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate         # Linux/Mac
.\venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials, Redis URL, and email settings

# Create database (PostgreSQL must be running)
# Create the 'gmc_store' database in pgAdmin or psql:
# CREATE DATABASE gmc_store;

# Run migrations
python manage.py migrate

# Seed sample data
python manage.py seed_data

# Start servers (run each in a separate terminal):

# 1. HTTP server (development)
python manage.py runserver

# 2. WebSocket server (for real-time chat)
pip install daphne
daphne config.asgi:application -p 8000

# 3. Celery worker (for email tasks)
celery -A config worker -l info

# 4. Celery Beat (for scheduled tasks like low-stock alerts)
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```


## Frontend Setup

```bash
cd gmc-frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit VITE_API_URL and VITE_WS_URL if needed

# Start development server
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Environment Variables

### Backend (.env)
| Variable | Description | Default |
|---|---|---|
| SECRET_KEY | Django secret key | (required in production) |
| DEBUG | Debug mode | True |
| DB_NAME | PostgreSQL database name | gmc_store |
| DB_USER | PostgreSQL username | postgres |
| DB_PASSWORD | PostgreSQL password | (set yours) |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| REDIS_URL | Redis connection URL | redis://localhost:6379/0 |
| CORS_ALLOWED_ORIGINS | Comma-separated allowed origins | http://localhost:5173 |
| EMAIL_HOST | SMTP server | smtp.mailgun.org |
| EMAIL_HOST_USER | SMTP username | |
| EMAIL_HOST_PASSWORD | SMTP password | |
| FRONTEND_URL | Frontend base URL | http://localhost:5173 |

### Frontend (.env)
| Variable | Description | Default |
|---|---|---|
| VITE_API_URL | Backend API URL | http://localhost:8000/api |
| VITE_WS_URL | WebSocket base URL | ws://localhost:8000 |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register/ | Create account, returns tokens |
| POST | /api/auth/login/ | Login, returns tokens |
| POST | /api/auth/token/refresh/ | Refresh access token |
| GET | /api/auth/me/ | Current user profile |
| PATCH | /api/auth/me/ | Update profile / avatar |
| POST | /api/auth/change-password/ | Change password |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/products/ | List products (filter: category, search) |
| GET | /api/products/{id}/ | Product detail |
| POST | /api/products/ | Admin: create product |
| PATCH | /api/products/{id}/ | Admin: update product |
| POST | /api/products/{id}/codes/ | Admin: bulk upload codes |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/orders/ | My orders |
| POST | /api/orders/ | Place order (deducts balance, delivers code) |
| GET | /api/orders/{id}/ | Order detail + code |

### Wallet
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/wallet/ | Balance, points, recent transactions |
| POST | /api/wallet/recharge/ | Submit recharge request |
| GET | /api/wallet/transactions/ | Full transaction history |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/chat/conversation/ | Get/create user's conversation |
| GET | /api/chat/messages/ | Paginated messages |
| POST | /api/chat/messages/ | Send message |
| PATCH | /api/chat/messages/read/ | Mark messages as read |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/admin/users/ | All users |
| PATCH | /api/admin/users/{id}/ | Update user balance/status |
| GET | /api/admin/recharges/ | Recharge requests |
| PATCH | /api/admin/recharges/{id}/ | Approve/reject recharge |
| GET | /api/admin/stats/ | Dashboard stats |
| GET | /api/admin/orders/ | All orders |
| GET | /api/admin/conversations/ | All chat conversations |

---

## WebSocket Chat

Connect to: `ws://localhost:8000/ws/chat/{conversation_id}/?token={access_token}`

**Send:**
```json
{ "body": "Hello!" }
```

**Receive:**
```json
{
  "id": 1,
  "body": "Hello!",
  "sender_id": 5,
  "sender_name": "alice",
  "attachment_url": null,
  "created_at": "2024-01-01T12:00:00Z",
  "is_read": false
}
```

---

## Business Logic

### Points System
- Earn **1 point per DT** spent on orders
- **100 points = 1 DT** discount
- Max points redemption = 50% of product price
- Points to redeem must be multiples of 100

### Order Flow (Atomic Transaction)
1. Verify user balance ≥ final price
2. Lock available code (`SELECT FOR UPDATE`)
3. Deduct balance from user
4. Earn points (add to user)
5. Mark code as sold
6. Create Order record
7. Create WalletTransaction records
8. Send confirmation email (via Celery)

### Recharge Flow
1. User submits request with payment proof image
2. Admin approves via Django Admin or API
3. Balance credited to user wallet atomically
4. Notification email sent to user (via Celery)

---

## Project Structure

```
GMC_Store/
├── gmc-backend/
│   ├── config/           # Django settings, urls, asgi, celery
│   ├── apps/
│   │   ├── users/        # Auth, profiles, wallet, admin views
│   │   ├── products/     # Catalog, categories, codes
│   │   ├── orders/       # Purchases, code delivery
│   │   ├── chat/         # Messenger, WebSocket consumer
│   │   └── payments/     # Recharge requests
│   ├── media/            # Uploaded files
│   └── requirements.txt
└── gmc-frontend/
    └── src/
        ├── api/          # Axios instance + API calls
        ├── components/   # Shared UI components
        ├── pages/        # Page components
        ├── store/        # Zustand state
        ├── hooks/        # Custom hooks
        └── utils/        # Formatters, constants
```

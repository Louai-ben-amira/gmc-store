@echo off
title GMC Store — Launcher
color 0A

echo.
echo  ================================================
echo   GMC Store — Starting all services
echo  ================================================
echo.

cd /d "%~dp0"

:: ── 1. Django backend ──────────────────────────────────────────────
echo  [1/2] Starting Django backend...
echo  (Telegram alerts run instantly in DEBUG mode — no Redis needed)
start "GMC - Django" cmd /k "cd /d %~dp0gmc-backend && venv\Scripts\python.exe manage.py runserver"
timeout /t 2 /nobreak >nul

:: ── 2. React frontend ─────────────────────────────────────────────
echo  [2/2] Starting React frontend...
start "GMC - Frontend" cmd /k "cd /d %~dp0gmc-frontend && npm run dev"

echo.
echo  ================================================
echo   Services started:
echo.
echo   Django   ^> http://localhost:8000
echo   Frontend ^> http://localhost:5173
echo.
echo   Telegram alerts fire instantly (CELERY_TASK_ALWAYS_EAGER)
echo   No Redis or Celery needed in development.
echo.
echo   NOTE: On production server, also run:
echo     celery -A config worker --pool=solo
echo     celery -A config beat
echo  ================================================
echo.
pause

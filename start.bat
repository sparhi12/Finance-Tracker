@echo off
title Finance Tracker
echo ============================================================
echo   Finance Tracker - Local-First Net Worth Tracker
echo ============================================================
echo.

set REPO_DIR=%~dp0
cd /d "%REPO_DIR%"

REM 1. Check Python virtual environment
if not exist "backend\venv\Scripts\python.exe" (
    echo [Setup] Creating Python virtual environment...
    python -m venv backend\venv
    echo [Setup] Installing backend dependencies...
    call backend\venv\Scripts\activate
    pip install -r backend\requirements.txt
)

REM 2. Check Frontend node_modules
if not exist "frontend\node_modules" (
    echo [Setup] Installing frontend npm dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "Finance Tracker Backend" cmd /k "cd /d "%REPO_DIR%backend" && call venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting React + Vite Frontend on http://localhost:5173 ...
start "Finance Tracker Frontend" cmd /k "cd /d "%REPO_DIR%frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser to http://localhost:5173 ...
start http://localhost:5173

echo.
echo Application started successfully!
echo To stop the application, close both the Backend and Frontend terminal windows.
pause

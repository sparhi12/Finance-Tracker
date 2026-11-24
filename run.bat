@echo off
title Finance Tracker
setlocal enabledelayedexpansion

echo ============================================================
echo   Finance Tracker - Local-First Net Worth Manager
echo ============================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Check Python installation
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python was not found on your system PATH!
    echo Please install Python 3.9+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

:: 2. Check Virtual Environment
if not exist "venv\Scripts\python.exe" (
    echo [Setup] Creating Python virtual environment...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [Setup] Installing required Python packages...
    call venv\Scripts\activate
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    call venv\Scripts\activate
)

:: 3. Run Application
echo.
echo [Starting] Launching Finance Tracker...
python run.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] The application stopped with an error code: %ERRORLEVEL%
    pause
)

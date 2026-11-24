@echo off
title Finance Tracker - Update Workflow
echo ============================================================
echo   Finance Tracker - Updating Application & Dependencies
echo ============================================================
echo.

set "REPO_DIR=%~dp0"
cd /d "%REPO_DIR%"

echo [1/3] Pulling latest code from Git repository...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo [Warning] git pull returned exit code %ERRORLEVEL%. Continuing with dependency checks...
)

echo.
echo [2/3] Updating Python dependencies...
if exist "venv\Scripts\python.exe" (
    call venv\Scripts\activate
    pip install -r requirements.txt --upgrade
) else (
    echo Virtual environment not found. Re-creating...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
)

echo.
echo [3/3] Update complete!
echo.
set /p RESTART="Do you want to start the application now? (Y/N): "
if /i "%RESTART%"=="Y" (
    call run.bat
)

pause

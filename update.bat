@echo off
title Simplifi Local - Update Workflow
echo ============================================================
echo   Simplifi Local - Updating Application & Dependencies
echo ============================================================
echo.

set REPO_DIR=%~dp0
cd /d "%REPO_DIR%"

echo [1/4] Pulling latest code from Git repository...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo [Warning] git pull returned exit code %ERRORLEVEL%. Continuing with dependency checks...
)

echo.
echo [2/4] Updating Python Backend dependencies...
if exist "backend\venv\Scripts\python.exe" (
    call backend\venv\Scripts\activate
    pip install -r backend\requirements.txt --upgrade
) else (
    echo Virtual environment not found. Re-creating...
    python -m venv backend\venv
    call backend\venv\Scripts\activate
    pip install -r backend\requirements.txt
)

echo.
echo [3/4] Updating Frontend NPM packages...
cd frontend
call npm install
cd ..

echo.
echo [4/4] Update complete!
echo.
set /p RESTART="Do you want to start the application now? (Y/N): "
if /i "%RESTART%"=="Y" (
    call start.bat
)

pause

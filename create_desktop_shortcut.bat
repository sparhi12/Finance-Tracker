@echo off
title Create Finance Tracker Desktop Shortcut
setlocal

echo ============================================================
echo   Creating Finance Tracker Desktop Shortcut...
echo ============================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%run.bat"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\Finance Tracker.lnk"

:: Use PowerShell to create the Windows shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = '%TARGET_BAT%'; " ^
    "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
    "$s.Description = 'Finance Tracker - Local-First Net Worth Manager'; " ^
    "$s.IconLocation = 'shell32.dll,43'; " ^
    "$s.Save();"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ============================================================
    echo   [SUCCESS] Shortcut created on your Desktop!
    echo.
    echo   Shortcut Name: Finance Tracker
    echo   Location:      %SHORTCUT_PATH%
    echo.
    echo   You can now launch Finance Tracker anytime by simply
    echo   double-clicking the 'Finance Tracker' icon on your desktop!
    echo ============================================================
) else (
    echo.
    echo [ERROR] Could not create desktop shortcut.
    echo You can still start the app by double-clicking 'run.bat' in this folder.
)

echo.
pause

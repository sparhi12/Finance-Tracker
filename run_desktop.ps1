# Finance Tracker - Desktop Launcher
# Starts backend & frontend silently, opens dedicated desktop app window,
# and automatically closes server connections when you close the window.

$ErrorActionPreference = "SilentlyContinue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $projectDir) { $projectDir = "C:\Users\sparh\OneDrive\Desktop\Projects" }
Set-Location $projectDir

# Clean up any lingering project servers first
Get-Process -Name "node", "uvicorn", "python" -ErrorAction SilentlyContinue | Where-Object { 
    $_.Path -like "*Projects*" 
} | Stop-Process -Force -ErrorAction SilentlyContinue

# 1. Start Backend Server
$backendPath = Join-Path $projectDir "backend\venv\Scripts\python.exe"
$backendDir = Join-Path $projectDir "backend"
$backendProcess = Start-Process -FilePath $backendPath `
    -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -PassThru

# 2. Start Frontend Server
$frontendDir = Join-Path $projectDir "frontend"
$frontendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev -- --host 127.0.0.1 --port 5173" `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden `
    -PassThru

# 3. Wait for Vite to be ready
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 400
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 1
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}

# 4. Locate Edge or Chrome to run in clean standalone app window
$browserPath = $null
$possibleBrowsers = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

foreach ($b in $possibleBrowsers) {
    if (Test-Path $b) {
        $browserPath = $b
        break
    }
}

try {
    if ($browserPath) {
        # Launch dedicated app window and wait until closed by user
        $browserProc = Start-Process -FilePath $browserPath `
            -ArgumentList "--app=http://localhost:5173/", "--new-window" `
            -PassThru
        $browserProc.WaitForExit()
    } else {
        # Fallback to default browser
        Start-Process "http://localhost:5173/"
        Write-Host "Finance Tracker is running. Close this console window when done to stop the app."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
} finally {
    # 5. Shut down servers when the app window is closed
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Kill any node/uvicorn child processes started in Projects folder
    Get-Process -Name "node", "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Finance Tracker - Desktop Launcher
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $projectDir) { $projectDir = Get-Location }
Set-Location $projectDir

# Launch master Python runner
$venvPython = Join-Path $projectDir "venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython (Join-Path $projectDir "run.py")
} else {
    python (Join-Path $projectDir "run.py")
}

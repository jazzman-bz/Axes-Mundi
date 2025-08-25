param(
    [int]$Lines = 200
)

# Determine log directory
$logDir = if ($env:AXM_ENV -eq "development") {
    Join-Path $PWD "logs"
} else {
    Join-Path $env:APPDATA "Axes-Mundi\logs"
}

$logFile = Join-Path $logDir "latest.log"

# Check if log file exists
if (!(Test-Path $logFile)) {
    Write-Host "No log file found at: $logFile" -ForegroundColor Yellow
    Write-Host "Make sure the app has been started at least once." -ForegroundColor Yellow
    exit 1
}

Write-Host "Tailing logs from: $logFile" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

# Tail the log file
Get-Content -Path $logFile -Wait -Tail $Lines








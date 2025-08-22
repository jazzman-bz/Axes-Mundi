param(
    [int]$Days = 7
)

# Determine log directory
$logDir = if ($env:AXM_ENV -eq "development") {
    Join-Path $PWD "logs"
} else {
    Join-Path $env:APPDATA "Axes-Mundi\logs"
}

# Check if log directory exists
if (!(Test-Path $logDir)) {
    Write-Host "No log directory found at: $logDir" -ForegroundColor Yellow
    exit 1
}

# Create destination filename with timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $PWD "logs-$timestamp.zip"

# Get log files from the last N days
$cutoffDate = (Get-Date).AddDays(-$Days)
$logFiles = Get-ChildItem $logDir -Filter "*.log" | Where-Object { $_.LastWriteTime -gt $cutoffDate }

if ($logFiles.Count -eq 0) {
    Write-Host "No log files found from the last $Days days" -ForegroundColor Yellow
    exit 1
}

# Create zip file
try {
    Compress-Archive -Path $logFiles.FullName -DestinationPath $dest -Force
    Write-Host "Log bundle created: $dest" -ForegroundColor Green
    Write-Host "Files included: $($logFiles.Count)" -ForegroundColor Gray
    Write-Host "Date range: $($logFiles | Sort-Object LastWriteTime | Select-Object -First 1 | ForEach-Object { $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm') }) to $($logFiles | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm') })" -ForegroundColor Gray
} catch {
    Write-Host "Error creating log bundle: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}




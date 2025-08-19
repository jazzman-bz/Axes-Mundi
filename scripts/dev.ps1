param(
    [switch]$Prod
)

# Set environment variables
if ($Prod) {
    $env:AXM_ENV = "production"
    $env:AXM_LOG_LEVEL = "info"
    Write-Host "Starting in PRODUCTION mode" -ForegroundColor Red
} else {
    $env:AXM_ENV = "development"
    $env:AXM_LOG_LEVEL = "debug"
    Write-Host "Starting in DEVELOPMENT mode" -ForegroundColor Green
}

$env:AXM_TELEMETRY = "off"

# Create logs directory if it doesn't exist
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    Write-Host "Created logs directory" -ForegroundColor Yellow
}

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start development servers
Write-Host "Starting Vite dev server and Electron..." -ForegroundColor Cyan
npm run dev



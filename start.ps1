# Claude Company System - PowerShell Startup Script
# Windows PowerShell startup script for Claude Company System

Write-Host "=== Claude Company System Startup ===" -ForegroundColor Green
Write-Host "Initializing Docker environment..." -ForegroundColor Yellow

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "✗ .env file not found. Creating from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host "✓ Created .env file. Please edit it with your ANTHROPIC_API_KEY" -ForegroundColor Green
        Write-Host "Opening .env file for editing..." -ForegroundColor Yellow
        notepad .env
        Read-Host "Press Enter after setting your API key to continue"
    } else {
        Write-Host "✗ Neither .env nor .env.example found. Please create .env file with ANTHROPIC_API_KEY" -ForegroundColor Red
        exit 1
    }
}

# Validate API key
$envContent = Get-Content ".env" -Raw
if ($envContent -match "ANTHROPIC_API_KEY=your_claude_api_key_here" -or $envContent -notmatch "ANTHROPIC_API_KEY=sk-") {
    Write-Host "✗ Please set a valid ANTHROPIC_API_KEY in .env file" -ForegroundColor Red
    notepad .env
    Read-Host "Press Enter after setting your API key to continue"
}

Write-Host "✓ Environment configuration validated" -ForegroundColor Green

# Create necessary directories
$directories = @("logs", "logs/boss", "logs/subordinate")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✓ Created directory: $dir" -ForegroundColor Green
    }
}

# Pull latest images
Write-Host "Pulling latest Docker images..." -ForegroundColor Yellow
docker-compose pull

# Build containers
Write-Host "Building Docker containers..." -ForegroundColor Yellow
docker-compose build --no-cache

# Start services
Write-Host "Starting Claude Company System..." -ForegroundColor Yellow
docker-compose up -d

# Wait for services to be ready
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host "Checking service health..." -ForegroundColor Yellow
$services = @("dashboard", "boss-controller", "redis", "elasticsearch")
foreach ($service in $services) {
    $status = docker-compose ps -q $service
    if ($status) {
        Write-Host "✓ $service is running" -ForegroundColor Green
    } else {
        Write-Host "✗ $service failed to start" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Claude Company System Started ===" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Kibana (Logs): http://localhost:5601" -ForegroundColor Cyan
Write-Host "Redis: localhost:6379" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Yellow
Write-Host "To stop: docker-compose down" -ForegroundColor Yellow
Write-Host ""

# Open dashboard in browser
Write-Host "Opening dashboard in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
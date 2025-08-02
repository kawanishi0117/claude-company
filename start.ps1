# Claude Company System - PowerShell Startup Script
# Windows PowerShell startup script for Claude Company System

Write-Host "=== Claude Company System Startup ===" -ForegroundColor Green
Write-Host "Initializing Docker environment..." -ForegroundColor Yellow

# Check if Docker is running
$dockerRunning = $false
$maxAttempts = 3
$attemptCount = 0

while (-not $dockerRunning -and $attemptCount -lt $maxAttempts) {
    try {
        docker version | Out-Null
        $dockerRunning = $true
        Write-Host "✓ Docker is running" -ForegroundColor Green
    } catch {
        $attemptCount++
        if ($attemptCount -eq 1) {
            Write-Host "✗ Docker is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
            
            # Try to start Docker Desktop
            $dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerDesktopPath) {
                Start-Process "$dockerDesktopPath"
                Write-Host "  Starting Docker Desktop... Please wait (this may take 30-60 seconds)" -ForegroundColor Yellow
                Start-Sleep -Seconds 30
            } else {
                Write-Host "✗ Docker Desktop not found at expected location" -ForegroundColor Red
                Write-Host "  Please start Docker Desktop manually from the Start Menu" -ForegroundColor Yellow
                Read-Host "Press Enter after Docker Desktop is running"
            }
        } elseif ($attemptCount -lt $maxAttempts) {
            Write-Host "  Waiting for Docker to start... (attempt $attemptCount of $maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 15
        }
    }
}

if (-not $dockerRunning) {
    Write-Host "✗ Failed to connect to Docker after $maxAttempts attempts" -ForegroundColor Red
    Write-Host "  Please ensure Docker Desktop is installed and running" -ForegroundColor Yellow
    Write-Host "  You can download it from: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
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
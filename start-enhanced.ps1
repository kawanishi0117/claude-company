# Enhanced Claude Company System - PowerShell Startup Script
# Comprehensive startup script with health checks and monitoring

param(
    [switch]$SkipHealthCheck,
    [switch]$Development,
    [int]$Replicas = $null,
    [switch]$NoCache,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Step { param($Message) Write-Host "→ $Message" -ForegroundColor Blue }

function Show-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                Claude Company System v2.0                    ║" -ForegroundColor Cyan
    Write-Host "║          AI-Powered Development Automation Platform          ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Success "Docker installed: $($dockerVersion.Split(' ')[2])"
        } else {
            throw "Docker not found"
        }
    } catch {
        Write-Error "Docker is not installed or not in PATH"
        Write-Info "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        exit 1
    }

    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version 2>$null
        if ($composeVersion) {
            Write-Success "Docker Compose available"
        } else {
            throw "Docker Compose not found"
        }
    } catch {
        Write-Error "Docker Compose is not available"
        exit 1
    }

    # Check if Docker daemon is running
    try {
        docker info | Out-Null
        Write-Success "Docker daemon is running"
    } catch {
        Write-Error "Docker daemon is not running. Please start Docker Desktop."
        Write-Info "Starting Docker Desktop automatically..."
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
        Write-Info "Waiting for Docker to start (this may take a few minutes)..."
        
        $timeout = 120
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            Start-Sleep -Seconds 5
            $elapsed += 5
            try {
                docker info | Out-Null
                Write-Success "Docker daemon is now running"
                break
            } catch {
                Write-Host "." -NoNewline
            }
        }
        
        if ($elapsed -ge $timeout) {
            Write-Error "Docker failed to start within $timeout seconds"
            exit 1
        }
    }

    # Check available disk space (minimum 5GB)
    $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB
    if ($freeSpace -lt 5) {
        Write-Warning "Low disk space: ${freeSpace:F1}GB available. Recommend at least 5GB"
    } else {
        Write-Success "Sufficient disk space: ${freeSpace:F1}GB available"
    }

    # Check available memory (minimum 4GB)
    $totalMemory = (Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB
    if ($totalMemory -lt 4) {
        Write-Warning "Low system memory: ${totalMemory:F1}GB. Recommend at least 4GB"
    } else {
        Write-Success "Sufficient memory: ${totalMemory:F1}GB available"
    }
}

function Initialize-Environment {
    Write-Step "Initializing environment configuration..."
    
    # Check .env file
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Warning ".env file not found. Creating from .env.example..."
            Copy-Item ".env.example" ".env"
            Write-Success "Created .env file"
            Write-Info "Opening .env file for configuration..."
            if (Get-Command "code" -ErrorAction SilentlyContinue) {
                code .env
            } else {
                notepad .env
            }
            Write-Warning "Please configure your ANTHROPIC_API_KEY and other settings"
            Read-Host "Press Enter after configuring .env to continue"
        } else {
            Write-Error "Neither .env nor .env.example found"
            Write-Info "Creating basic .env file..."
            @"
# Claude Company System Environment Configuration
ANTHROPIC_API_KEY=your_claude_api_key_here
SUBORDINATE_REPLICAS=3
LOG_LEVEL=info
NODE_ENV=production
REDIS_PASSWORD=claudecompany
REDIS_URL=redis://redis:6379
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
ES_JAVA_OPTS=-Xms512m -Xmx512m
COMPOSE_PROJECT_NAME=claude-company-system
"@ | Out-File -FilePath ".env" -Encoding UTF8
            Write-Success "Created basic .env file"
            notepad .env
            Read-Host "Press Enter after configuring .env to continue"
        }
    }

    # Validate environment variables
    $envContent = Get-Content ".env" -Raw
    $apiKeyPattern = "ANTHROPIC_API_KEY=sk-ant-[a-zA-Z0-9_-]+"
    
    if ($envContent -match "ANTHROPIC_API_KEY=your_claude_api_key_here" -or $envContent -notmatch $apiKeyPattern) {
        Write-Error "Invalid ANTHROPIC_API_KEY in .env file"
        Write-Info "Your API key should start with 'sk-ant-' and be from your Anthropic account"
        Write-Info "Get your API key from: https://console.anthropic.com/"
        notepad .env
        Read-Host "Press Enter after setting your API key to continue"
        
        # Re-validate
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match "ANTHROPIC_API_KEY=your_claude_api_key_here" -or $envContent -notmatch $apiKeyPattern) {
            Write-Error "API key still invalid. Exiting."
            exit 1
        }
    }
    
    Write-Success "Environment configuration validated"

    # Set replicas if specified
    if ($Replicas) {
        (Get-Content ".env") -replace "SUBORDINATE_REPLICAS=\d+", "SUBORDINATE_REPLICAS=$Replicas" | Set-Content ".env"
        Write-Success "Set SUBORDINATE_REPLICAS to $Replicas"
    }

    # Set development mode if specified
    if ($Development) {
        (Get-Content ".env") -replace "NODE_ENV=production", "NODE_ENV=development" | Set-Content ".env"
        (Get-Content ".env") -replace "LOG_LEVEL=info", "LOG_LEVEL=debug" | Set-Content ".env"
        Write-Success "Enabled development mode with debug logging"
    }
}

function Initialize-Directories {
    Write-Step "Creating necessary directories..."
    
    $directories = @(
        "logs",
        "logs/boss",
        "logs/subordinate", 
        "logs/dashboard",
        "logs/redis",
        "logs/elasticsearch",
        "data",
        "data/redis",
        "data/elasticsearch"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }
}

function Build-System {
    Write-Step "Building Docker containers..."
    
    $buildArgs = @("build")
    if ($NoCache) {
        $buildArgs += "--no-cache"
    }
    if ($Verbose) {
        $buildArgs += "--progress=plain"
    }
    
    Write-Info "Running: docker-compose $($buildArgs -join ' ')"
    & docker-compose @buildArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build containers"
        exit 1
    }
    
    Write-Success "Containers built successfully"
}

function Start-Services {
    Write-Step "Starting Claude Company System services..."
    
    # Get replica count from .env
    $envReplicas = (Get-Content ".env" | Where-Object { $_ -match '^SUBORDINATE_REPLICAS=' }) -replace 'SUBORDINATE_REPLICAS=', ''
    if (-not $envReplicas) { $envReplicas = 3 }
    
    Write-Info "Starting with $envReplicas subordinate AI replicas"
    
    # Start core services first
    Write-Info "Starting core infrastructure (Redis, Elasticsearch)..."
    docker-compose up -d redis elasticsearch
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start core services"
        exit 1
    }
    
    # Wait for core services
    Write-Info "Waiting for core services to initialize..."
    Start-Sleep -Seconds 15
    
    # Start application services
    Write-Info "Starting application services..."
    docker-compose up -d --scale subordinate-controller=$envReplicas
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start application services"
        exit 1
    }
    
    Write-Success "All services started"
}

function Test-ServiceHealth {
    if ($SkipHealthCheck) {
        Write-Warning "Skipping health checks"
        return
    }
    
    Write-Step "Performing health checks..."
    
    $services = @{
        "Redis" = @{ port = 6379; timeout = 30 }
        "Dashboard" = @{ port = 3000; timeout = 60; path = "/" }
        "Boss Controller API" = @{ port = 8000; timeout = 45; path = "/health" }
        "Elasticsearch" = @{ port = 9200; timeout = 60; path = "/" }
        "Kibana" = @{ port = 5601; timeout = 90; path = "/" }
    }
    
    foreach ($service in $services.GetEnumerator()) {
        $name = $service.Key
        $config = $service.Value
        $port = $config.port
        $timeout = $config.timeout
        $path = $config.path
        
        Write-Info "Checking $name (port $port)..."
        
        $elapsed = 0
        $healthy = $false
        
        while ($elapsed -lt $timeout -and -not $healthy) {
            try {
                if ($path) {
                    $response = Invoke-WebRequest -Uri "http://localhost:$port$path" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
                    if ($response.StatusCode -eq 200) {
                        $healthy = $true
                    }
                } else {
                    $tcpClient = New-Object System.Net.Sockets.TcpClient
                    $tcpClient.Connect("localhost", $port)
                    $tcpClient.Close()
                    $healthy = $true
                }
            } catch {
                Start-Sleep -Seconds 3
                $elapsed += 3
                Write-Host "." -NoNewline
            }
        }
        
        if ($healthy) {
            Write-Success "$name is healthy"
        } else {
            Write-Error "$name failed health check (timeout: ${timeout}s)"
        }
    }
    
    # Check Docker container status
    Write-Info "Checking container status..."
    $containers = docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"
    Write-Host $containers
    
    # Check for any failed containers
    $failedContainers = docker-compose ps -q --filter "status=exited"
    if ($failedContainers) {
        Write-Warning "Some containers have exited. Checking logs..."
        foreach ($container in $failedContainers) {
            $containerName = docker inspect --format='{{.Name}}' $container
            Write-Warning "Container $containerName exited. Recent logs:"
            docker logs --tail 10 $container
        }
    }
}

function Show-SystemInfo {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    System Started Successfully!              ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "   Dashboard:        http://localhost:3000" -ForegroundColor White
    Write-Host "   API Endpoint:     http://localhost:8000" -ForegroundColor White
    Write-Host "   Kibana (Logs):    http://localhost:5601" -ForegroundColor White
    Write-Host "   Redis:            localhost:6379" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🔧 Management Commands:" -ForegroundColor Cyan
    Write-Host "   View all logs:    docker-compose logs -f" -ForegroundColor White
    Write-Host "   View boss logs:   docker-compose logs -f boss-controller" -ForegroundColor White
    Write-Host "   View sub logs:    docker-compose logs -f subordinate-controller" -ForegroundColor White
    Write-Host "   Scale subordinates: docker-compose up -d --scale subordinate-controller=5" -ForegroundColor White
    Write-Host "   Stop system:      docker-compose down" -ForegroundColor White
    Write-Host "   Restart system:   docker-compose restart" -ForegroundColor White
    Write-Host ""
    
    Write-Host "📊 System Status:" -ForegroundColor Cyan
    $runningContainers = (docker-compose ps -q).Count
    Write-Host "   Running containers: $runningContainers" -ForegroundColor White
    
    $subordinateCount = (docker-compose ps subordinate-controller -q).Count
    Write-Host "   Subordinate AIs:    $subordinateCount" -ForegroundColor White
    Write-Host ""
    
    # Show resource usage
    Write-Host "💾 Resource Usage:" -ForegroundColor Cyan
    $stats = docker-compose ps --format "json" | ConvertFrom-Json
    $totalMemory = 0
    $totalCpu = 0
    foreach ($container in $stats) {
        try {
            $stat = docker stats --no-stream --format "{{.MemUsage}}\t{{.CPUPerc}}" $container.Name 2>$null
            if ($stat) {
                Write-Host "   $($container.Name): $stat" -ForegroundColor White
            }
        } catch {}
    }
    Write-Host ""
}

function Start-Dashboard {
    Write-Step "Opening dashboard in browser..."
    
    # Wait a moment for services to be fully ready
    Start-Sleep -Seconds 3
    
    try {
        Start-Process "http://localhost:3000"
        Write-Success "Dashboard opened in browser"
    } catch {
        Write-Warning "Could not open browser automatically"
        Write-Info "Please navigate to http://localhost:3000 manually"
    }
}

# Main execution
try {
    Show-Banner
    Test-Prerequisites
    Initialize-Environment
    Initialize-Directories
    
    # Pull latest images if not in development mode
    if (-not $Development) {
        Write-Step "Pulling latest Docker images..."
        docker-compose pull
    }
    
    Build-System
    Start-Services
    Test-ServiceHealth
    Show-SystemInfo
    Start-Dashboard
    
    Write-Host ""
    Write-Success "Claude Company System startup completed successfully!"
    Write-Info "The system is running in the background. Check the dashboard for real-time status."
    Write-Host ""
    
} catch {
    Write-Error "Startup failed: $($_.Exception.Message)"
    Write-Info "Check the logs with: docker-compose logs"
    Write-Info "For help, see the troubleshooting guide in README.md"
    exit 1
}

# Keep PowerShell window open
if (-not $env:CI) {
    Read-Host "Press Enter to exit"
}
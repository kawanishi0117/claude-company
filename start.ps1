# Claude Company System - PowerShell Startup Script
# Windows PowerShell startup script for Claude Company System

Write-Host "=== Claude Company System Startup ===" -ForegroundColor Green
Write-Host "Initializing Docker environment..." -ForegroundColor Yellow

# Detect if using WSL
$useWSL = $false
$wslAvailable = $false
try {
    wsl --status 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $wslAvailable = $true
        # Check if Docker is available in Windows, if not, use WSL
        try {
            docker version 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                $useWSL = $true
            }
        } catch {
            $useWSL = $true
        }
    }
} catch {
    $wslAvailable = $false
}

# Load environment variables
$envVars = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $envVars[$matches[1]] = $matches[2]
        }
    }
}

# Get WSL distribution from environment or auto-detect
$wslDistro = "Ubuntu"  # Default fallback
if ($envVars["WSL_DISTRIBUTION"] -and $envVars["WSL_DISTRIBUTION"] -ne "") {
    $wslDistro = $envVars["WSL_DISTRIBUTION"]
    Write-Host "Using WSL distribution from .env: $wslDistro" -ForegroundColor Cyan
} else {
    # Auto-detect with better encoding handling
    try {
        # Test if Ubuntu works (most common)
        $testUbuntu = wsl -d "Ubuntu" echo "test" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $wslDistro = "Ubuntu"
        } else {
            # Try to parse wsl --list output more carefully
            $wslList = wsl --list --quiet 2>$null
            if ($wslList) {
                # Clean up the output and find a working distribution
                $cleanList = $wslList | Where-Object { $_ -match '^[A-Za-z][A-Za-z0-9-]*$' }
                foreach ($distro in $cleanList) {
                    $test = wsl -d $distro echo "test" 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        $wslDistro = $distro
                        break
                    }
                }
            }
        }
    } catch {
        # Use Ubuntu as final fallback
    }
}

# Check docker mode preference
$dockerMode = $envVars["DOCKER_MODE"]
if ($dockerMode -eq "windows") {
    $useWSL = $false
    Write-Host "Docker mode set to Windows in .env" -ForegroundColor Cyan
} elseif ($dockerMode -eq "wsl") {
    $useWSL = $true
    Write-Host "Docker mode set to WSL in .env" -ForegroundColor Cyan
}

# Function to run commands in WSL
function Invoke-WSLCommand {
    param($Command)
    $currentPath = (Get-Location).Path
    $wslPath = "/mnt/" + $currentPath.ToLower().Replace(":\", "/").Replace("\", "/")
    return wsl --distribution $wslDistro --exec bash -c "cd '$wslPath' && $Command"
}

# Check Docker status
$dockerRunning = $false
if ($useWSL -and $wslAvailable) {
    Write-Host "🐧 Using Docker Engine in WSL..." -ForegroundColor Cyan
    
    # Check Docker in WSL
    $dockerStatus = Invoke-WSLCommand "docker version > /dev/null 2>&1 && echo 'running' || echo 'stopped'"
    if ($dockerStatus -match "stopped") {
        Write-Host "Starting Docker Engine in WSL..." -ForegroundColor Yellow
        
        # Start Docker in WSL
        wsl --distribution $wslDistro --exec sudo service docker start
        Start-Sleep -Seconds 5
        
        # Check again
        $dockerStatus = Invoke-WSLCommand "docker version > /dev/null 2>&1 && echo 'running' || echo 'stopped'"
        if ($dockerStatus -match "running") {
            $dockerRunning = $true
            Write-Host "✓ Docker Engine is running in WSL" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to start Docker Engine in WSL" -ForegroundColor Red
            Write-Host "Please run in WSL: sudo service docker start" -ForegroundColor Yellow
            exit 1
        }
    } else {
        $dockerRunning = $true
        Write-Host "✓ Docker Engine is already running in WSL" -ForegroundColor Green
    }
    
    # Check Docker network connectivity
    Write-Host "Checking Docker network..." -ForegroundColor Yellow
    $networkTest = Invoke-WSLCommand "docker run --rm --name network-test alpine ping -c 1 8.8.8.8 > /dev/null 2>&1 && echo 'ok' || echo 'failed'"
    if ($networkTest -match "failed") {
        Write-Host "⚠ Docker network issue detected. Running network fix..." -ForegroundColor Yellow
        $fixScript = Join-Path $PSScriptRoot "fix-docker-network.ps1"
        if (Test-Path $fixScript) {
            & $fixScript
        } else {
            Write-Host "Network fix script not found. Manual intervention may be required." -ForegroundColor Red
        }
    }
    
    # Check if docker-compose is installed
    $dockerComposeCheck = Invoke-WSLCommand "which docker-compose > /dev/null 2>&1 && echo 'installed' || echo 'missing'"
    if ($dockerComposeCheck -match "missing") {
        # Try docker compose (v2)
        $dockerComposeV2Check = Invoke-WSLCommand "docker compose version > /dev/null 2>&1 && echo 'installed' || echo 'missing'"
        if ($dockerComposeV2Check -match "missing") {
            Write-Host "✗ docker-compose is not installed in WSL" -ForegroundColor Red
            Write-Host "Installing docker-compose..." -ForegroundColor Yellow
            
            $installScript = Join-Path $PSScriptRoot "setup\windows\install-docker-compose-wsl.sh"
            if (Test-Path $installScript) {
                $installScriptWSL = $installScript.Replace('\', '/').Replace('C:', '/mnt/c')
                wsl --distribution $wslDistro --exec bash "$installScriptWSL"
            } else {
                Write-Host "Please install docker-compose in WSL:" -ForegroundColor Yellow
                Write-Host "  sudo apt-get update" -ForegroundColor Cyan
                Write-Host "  sudo apt-get install -y docker-compose-plugin" -ForegroundColor Cyan
                exit 1
            }
        }
    }
} else {
    # Try Windows Docker
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
                Write-Host "✗ Docker is not running." -ForegroundColor Yellow
                
                # Try Docker Desktop
                Write-Host "Attempting to start Docker Desktop..." -ForegroundColor Yellow
                
                $dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
                if (Test-Path $dockerDesktopPath) {
                    Start-Process "$dockerDesktopPath"
                    Write-Host "  Starting Docker Desktop... Please wait (this may take 30-60 seconds)" -ForegroundColor Yellow
                    Start-Sleep -Seconds 30
                } else {
                    Write-Host "✗ Docker Desktop not found" -ForegroundColor Red
                    if ($wslAvailable) {
                        Write-Host "  WSL is available. Switching to WSL Docker Engine..." -ForegroundColor Yellow
                        $useWSL = $true
                        break
                    } else {
                        Write-Host "  Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
                        exit 1
                    }
                }
            } elseif ($attemptCount -lt $maxAttempts) {
                Write-Host "  Waiting for Docker to start... (attempt $attemptCount of $maxAttempts)" -ForegroundColor Yellow
                Start-Sleep -Seconds 15
            }
        }
    }
    
    # If Docker Desktop failed and WSL is available, switch to WSL
    if (-not $dockerRunning -and $wslAvailable) {
        Write-Host "Switching to WSL Docker Engine..." -ForegroundColor Yellow
        $useWSL = $true
        
        # Start Docker in WSL
        wsl --distribution $wslDistro --exec sudo service docker start
        Start-Sleep -Seconds 5
        
        $dockerStatus = Invoke-WSLCommand "docker version > /dev/null 2>&1 && echo 'running' || echo 'stopped'"
        if ($dockerStatus -match "running") {
            $dockerRunning = $true
            Write-Host "✓ Docker Engine is running in WSL" -ForegroundColor Green
        }
    }
}

if (-not $dockerRunning) {
    Write-Host "✗ Failed to start Docker" -ForegroundColor Red
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

# Define docker-compose command based on environment
if ($useWSL) {
    Write-Host "Running docker-compose commands through WSL..." -ForegroundColor Yellow
    
    # Determine which docker-compose command to use
    $dockerComposeCmd = "docker-compose"
    $dockerComposeV2Check = Invoke-WSLCommand "docker compose version > /dev/null 2>&1 && echo 'v2' || echo 'v1'"
    if ($dockerComposeV2Check -match "v2") {
        $dockerComposeCmd = "docker compose"
    }
    
    # Pull latest images
    Write-Host "Pulling latest Docker images..." -ForegroundColor Yellow
    Invoke-WSLCommand "$dockerComposeCmd pull"
    
    # Build containers
    Write-Host "Building Docker containers..." -ForegroundColor Yellow
    Invoke-WSLCommand "$dockerComposeCmd build --no-cache"
    
    # Start services
    Write-Host "Starting Claude Company System..." -ForegroundColor Yellow
    Invoke-WSLCommand "$dockerComposeCmd up -d"
    
    # Wait for services to be ready
    Write-Host "Waiting for services to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Check service health
    Write-Host "Checking service health..." -ForegroundColor Yellow
    $services = @("dashboard", "boss-controller", "redis", "elasticsearch")
    foreach ($service in $services) {
        $status = Invoke-WSLCommand "$dockerComposeCmd ps -q $service"
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
    Write-Host "To view logs: wsl -d $wslDistro -e $dockerComposeCmd logs -f" -ForegroundColor Yellow
    Write-Host "To stop: wsl -d $wslDistro -e $dockerComposeCmd down" -ForegroundColor Yellow
} else {
    # Use Windows Docker commands
    Write-Host "Pulling latest Docker images..." -ForegroundColor Yellow
    docker-compose pull
    
    Write-Host "Building Docker containers..." -ForegroundColor Yellow
    docker-compose build --no-cache
    
    Write-Host "Starting Claude Company System..." -ForegroundColor Yellow
    docker-compose up -d
    
    Write-Host "Waiting for services to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
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
}

Write-Host ""

# Open dashboard in browser
Write-Host "Opening dashboard in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
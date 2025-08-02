# Quick Docker test and basic fix

Write-Host "=== Quick Docker Test ===" -ForegroundColor Green

# Load WSL distribution from .env
$envVars = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $envVars[$matches[1]] = $matches[2]
        }
    }
}

$wslDistro = $envVars["WSL_DISTRIBUTION"]
if (-not $wslDistro) {
    $wslDistro = "Ubuntu"
}

Write-Host "Testing Docker in WSL distribution: $wslDistro" -ForegroundColor Cyan

# Test 1: Check if Docker is running
Write-Host "`n1. Testing Docker status..." -ForegroundColor Yellow
$dockerStatus = wsl -d $wslDistro --exec bash -c "docker version 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker is running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    Write-Host "Attempting to start Docker..." -ForegroundColor Yellow
    wsl -d $wslDistro --exec sudo systemctl start docker
    Start-Sleep -Seconds 5
}

# Test 2: Try simple container run
Write-Host "`n2. Testing container run..." -ForegroundColor Yellow
$containerTest = wsl -d $wslDistro --exec bash -c "docker run --rm hello-world 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Container test successful" -ForegroundColor Green
} else {
    Write-Host "✗ Container test failed" -ForegroundColor Red
    if ($containerTest -match "network") {
        Write-Host "Network issue detected!" -ForegroundColor Yellow
        Write-Host "Applying quick network fix..." -ForegroundColor Yellow
        
        # Quick network fix
        wsl -d $wslDistro --exec sudo bash -c "sysctl net.ipv4.ip_forward=1"
        wsl -d $wslDistro --exec sudo bash -c "systemctl restart docker"
        Start-Sleep -Seconds 5
        
        Write-Host "Retesting..." -ForegroundColor Yellow
        $containerTest2 = wsl -d $wslDistro --exec bash -c "docker run --rm hello-world 2>&1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Fixed! Container test now works" -ForegroundColor Green
        } else {
            Write-Host "✗ Still having issues" -ForegroundColor Red
        }
    }
}

# Test 3: Check docker-compose
Write-Host "`n3. Testing docker-compose..." -ForegroundColor Yellow
$composeTest = wsl -d $wslDistro --exec bash -c "docker compose version 2>&1 || docker-compose --version 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ docker-compose is available" -ForegroundColor Green
} else {
    Write-Host "✗ docker-compose not found" -ForegroundColor Red
}

Write-Host "`nQuick test completed!" -ForegroundColor Green
Write-Host "If all tests passed, try running start.ps1" -ForegroundColor Cyan
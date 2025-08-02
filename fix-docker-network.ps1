# Fix Docker Network Issues in WSL

param(
    [switch]$Force
)

Write-Host "=== Docker Network Fix for WSL ===" -ForegroundColor Green

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

Write-Host "Using WSL distribution: $wslDistro" -ForegroundColor Cyan

# Step 1: Stop Docker
Write-Host "`n1. Stopping Docker services..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo systemctl stop docker 2>$null
wsl -d $wslDistro --exec sudo service docker stop 2>$null
wsl -d $wslDistro --exec sudo pkill dockerd 2>$null
Start-Sleep -Seconds 3

# Step 2: Clean up Docker networks
Write-Host "2. Cleaning up Docker networks..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo ip link delete docker0 2>$null
wsl -d $wslDistro --exec sudo iptables -t nat -F 2>$null
wsl -d $wslDistro --exec sudo iptables -t filter -F 2>$null

# Step 3: Create/Update Docker daemon configuration
Write-Host "3. Configuring Docker daemon..." -ForegroundColor Yellow
$dockerConfig = @"
{
  "bridge": "docker0",
  "bip": "172.17.0.1/16",
  "fixed-cidr": "172.17.0.0/16",
  "iptables": true,
  "ip-forward": true,
  "ip-masq": true,
  "userland-proxy": true,
  "data-root": "/var/lib/docker",
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
"@

# Write Docker configuration
$configScript = @"
sudo mkdir -p /etc/docker
echo '$dockerConfig' | sudo tee /etc/docker/daemon.json > /dev/null
sudo chmod 644 /etc/docker/daemon.json
"@

wsl -d $wslDistro --exec bash -c $configScript

# Step 4: Enable IP forwarding
Write-Host "4. Enabling IP forwarding..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo sysctl net.ipv4.ip_forward=1
wsl -d $wslDistro --exec bash -c "echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf"

# Step 5: Load bridge module
Write-Host "5. Loading bridge module..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo modprobe bridge
wsl -d $wslDistro --exec sudo modprobe br_netfilter

# Step 6: Start Docker with proper configuration
Write-Host "6. Starting Docker with network configuration..." -ForegroundColor Yellow

# Try systemctl first
$systemdResult = wsl -d $wslDistro --exec sudo systemctl start docker 2>&1
Start-Sleep -Seconds 5

# Check if Docker started successfully
$dockerStatus = wsl -d $wslDistro --exec docker version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Systemctl failed, trying manual startup..." -ForegroundColor Yellow
    
    # Manual dockerd startup with explicit bridge configuration
    $manualStart = @"
sudo dockerd \
  --bridge docker0 \
  --bip 172.17.0.1/16 \
  --fixed-cidr 172.17.0.0/16 \
  --iptables=true \
  --ip-forward=true \
  --ip-masq=true \
  --userland-proxy=true \
  --data-root /var/lib/docker \
  --pidfile /var/run/docker.pid \
  --exec-root /var/run/docker \
  > /var/log/docker.log 2>&1 &
"@
    
    wsl -d $wslDistro --exec bash -c $manualStart
    Start-Sleep -Seconds 10
}

# Step 7: Verify Docker is working
Write-Host "7. Verifying Docker network..." -ForegroundColor Yellow
$dockerTest = wsl -d $wslDistro --exec docker version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Docker is running!" -ForegroundColor Green
    
    # Test network connectivity
    $networkTest = wsl -d $wslDistro --exec docker run --rm alpine ping -c 1 8.8.8.8 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Network connectivity works!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Network connectivity test failed" -ForegroundColor Yellow
        Write-Host "   This might not affect local builds" -ForegroundColor Gray
    }
    
    # Show network status
    Write-Host "`nDocker network status:" -ForegroundColor Cyan
    wsl -d $wslDistro --exec docker network ls
    
} else {
    Write-Host "   ✗ Docker failed to start properly" -ForegroundColor Red
    Write-Host "   Error: $dockerTest" -ForegroundColor Gray
    
    Write-Host "`nTroubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Restart WSL: wsl --shutdown && wsl -d $wslDistro" -ForegroundColor White
    Write-Host "2. Check Docker logs: wsl -d $wslDistro sudo tail -f /var/log/docker.log" -ForegroundColor White
    Write-Host "3. Try manual Docker start: wsl -d $wslDistro sudo dockerd" -ForegroundColor White
}

Write-Host "`nNetwork fix completed!" -ForegroundColor Green
Write-Host "You can now try running start.ps1 again" -ForegroundColor Cyan
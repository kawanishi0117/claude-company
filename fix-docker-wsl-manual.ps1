# Manual Docker Fix for WSL (avoiding line ending issues)

Write-Host "=== Manual Docker Network Fix for WSL ===" -ForegroundColor Green

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
Write-Host "You will be asked for sudo password once..." -ForegroundColor Yellow

# Execute each command separately to avoid line ending issues
Write-Host "`n1. Stopping Docker..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo bash -c "systemctl stop docker 2>/dev/null || service docker stop 2>/dev/null || pkill dockerd 2>/dev/null || true"

Write-Host "2. Waiting..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "3. Cleaning networks..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo bash -c "ip link delete docker0 2>/dev/null || true"
wsl -d $wslDistro --exec sudo bash -c "iptables -t nat -F 2>/dev/null || true"

Write-Host "4. Loading modules..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo bash -c "modprobe bridge 2>/dev/null || true"
wsl -d $wslDistro --exec sudo bash -c "modprobe br_netfilter 2>/dev/null || true"

Write-Host "5. Enabling IP forwarding..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo bash -c "sysctl net.ipv4.ip_forward=1"

Write-Host "6. Creating Docker config..." -ForegroundColor Yellow
$dockerConfig = @'
{
  "bridge": "docker0",
  "bip": "172.17.0.1/16",
  "iptables": true,
  "ip-forward": true,
  "data-root": "/var/lib/docker",
  "storage-driver": "overlay2"
}
'@

# Create config using echo to avoid file transfer issues
wsl -d $wslDistro --exec sudo bash -c "mkdir -p /etc/docker"
$dockerConfig | wsl -d $wslDistro --exec sudo bash -c "cat > /etc/docker/daemon.json"
wsl -d $wslDistro --exec sudo bash -c "chmod 644 /etc/docker/daemon.json"

Write-Host "7. Starting Docker..." -ForegroundColor Yellow
$startResult = wsl -d $wslDistro --exec sudo bash -c "systemctl start docker 2>&1 || service docker start 2>&1"

Start-Sleep -Seconds 5

Write-Host "8. Testing Docker..." -ForegroundColor Yellow
$dockerTest = wsl -d $wslDistro --exec bash -c "docker version 2>&1"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker is running!" -ForegroundColor Green
    
    # Show Docker info
    Write-Host "`nDocker status:" -ForegroundColor Cyan
    wsl -d $wslDistro --exec docker version --format "Client: {{.Client.Version}} | Server: {{.Server.Version}}"
    
} else {
    Write-Host "✗ Docker is not running properly" -ForegroundColor Red
    Write-Host "Docker output: $dockerTest" -ForegroundColor Gray
    
    Write-Host "`nTrying alternative startup..." -ForegroundColor Yellow
    wsl -d $wslDistro --exec sudo bash -c "dockerd --data-root=/var/lib/docker --pidfile=/var/run/docker.pid > /var/log/docker.log 2>&1 &"
    Start-Sleep -Seconds 10
    
    $dockerTest2 = wsl -d $wslDistro --exec bash -c "docker version 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker started with alternative method!" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker startup failed" -ForegroundColor Red
        Write-Host "Try running: wsl --shutdown && wsl -d $wslDistro" -ForegroundColor Yellow
    }
}

Write-Host "`nDocker network fix completed!" -ForegroundColor Green
Write-Host "Try running start.ps1 now" -ForegroundColor Cyan
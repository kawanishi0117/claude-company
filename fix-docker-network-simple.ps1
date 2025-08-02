# Simple Docker Network Fix for WSL (with minimal sudo calls)

Write-Host "=== Docker Network Fix for WSL (Simple) ===" -ForegroundColor Green

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

# Create a comprehensive fix script that runs with a single sudo call
$fixScript = @'
#!/bin/bash
set -e

echo "Stopping Docker services..."
systemctl stop docker 2>/dev/null || service docker stop 2>/dev/null || pkill dockerd 2>/dev/null || true
sleep 3

echo "Cleaning up networks..."
ip link delete docker0 2>/dev/null || true
iptables -t nat -F 2>/dev/null || true
iptables -t filter -F 2>/dev/null || true

echo "Loading kernel modules..."
modprobe bridge 2>/dev/null || true
modprobe br_netfilter 2>/dev/null || true
modprobe overlay 2>/dev/null || true

echo "Enabling IP forwarding..."
sysctl net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf 2>/dev/null || true

echo "Configuring Docker daemon..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
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
  },
  "dns": ["8.8.8.8", "8.8.4.4"]
}
EOF

chmod 644 /etc/docker/daemon.json

echo "Starting Docker..."
systemctl start docker 2>/dev/null || service docker start 2>/dev/null || {
    echo "Starting dockerd manually..."
    dockerd --config-file /etc/docker/daemon.json > /var/log/docker.log 2>&1 &
    sleep 10
}

echo "Testing Docker..."
if docker version > /dev/null 2>&1; then
    echo "✓ Docker is running!"
    
    # Quick network test
    if timeout 10 docker run --rm alpine ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        echo "✓ Network test passed!"
    else
        echo "⚠ Network test failed, but Docker is running"
    fi
else
    echo "✗ Docker startup failed"
    echo "Check logs: tail /var/log/docker.log"
fi

echo "Docker network fix completed!"
'@

# Write the script to a temporary file in WSL
$tempScript = "/tmp/docker-fix-$(Get-Random).sh"
$fixScript | wsl -d $wslDistro --exec bash -c "cat > $tempScript && chmod +x $tempScript"

# Execute the script with a single sudo call
Write-Host "Executing Docker network fix..." -ForegroundColor Yellow
wsl -d $wslDistro --exec sudo bash $tempScript

# Clean up
wsl -d $wslDistro --exec rm -f $tempScript

Write-Host "`nNetwork fix completed!" -ForegroundColor Green
Write-Host "You can now try running start.ps1 again" -ForegroundColor Cyan
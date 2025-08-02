#!/bin/bash
# Setup Docker for WSL2 with proper network configuration

set -e

echo "=== Setting up Docker for WSL2 ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

# Stop Docker if running
echo "1. Stopping Docker services..."
systemctl stop docker 2>/dev/null || service docker stop 2>/dev/null || true
pkill dockerd 2>/dev/null || true
sleep 3

# Clean up existing networks
echo "2. Cleaning up networks..."
ip link delete docker0 2>/dev/null || true
iptables -t nat -F 2>/dev/null || true
iptables -t filter -F 2>/dev/null || true

# Load required kernel modules
echo "3. Loading kernel modules..."
modprobe bridge
modprobe br_netfilter
modprobe overlay

# Enable IP forwarding
echo "4. Enabling IP forwarding..."
sysctl net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf

# Create Docker daemon configuration
echo "5. Configuring Docker daemon..."
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
  "dns": ["8.8.8.8", "8.8.4.4"],
  "mtu": 1500
}
EOF

# Set permissions
chmod 644 /etc/docker/daemon.json

# Enable Docker service
echo "6. Enabling Docker service..."
systemctl enable docker 2>/dev/null || update-rc.d docker enable 2>/dev/null

# Start Docker
echo "7. Starting Docker..."
systemctl start docker 2>/dev/null || service docker start 2>/dev/null

# Wait for Docker to be ready
echo "8. Waiting for Docker to be ready..."
sleep 10

# Test Docker
echo "9. Testing Docker..."
if docker version > /dev/null 2>&1; then
    echo "✓ Docker is running successfully!"
    
    # Test network
    if docker run --rm alpine ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        echo "✓ Docker network is working!"
    else
        echo "⚠ Docker network test failed, but Docker is running"
    fi
    
    # Show network info
    echo -e "\nDocker network information:"
    docker network ls
    
else
    echo "✗ Docker failed to start"
    echo "Check logs with: journalctl -u docker.service"
    exit 1
fi

echo -e "\n=== Docker setup completed successfully! ==="
echo "You can now run docker commands and build containers."
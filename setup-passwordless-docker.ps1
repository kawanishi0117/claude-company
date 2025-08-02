# Setup passwordless Docker commands in WSL

Write-Host "=== Setting up passwordless Docker commands ===" -ForegroundColor Green

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
Write-Host "You will be asked for sudo password once to setup passwordless Docker..." -ForegroundColor Yellow

# Create sudoers configuration script
$setupScript = @'
#!/bin/bash
USER=$(whoami)
echo "Setting up passwordless sudo for Docker commands for user: $USER"

# Create sudoers configuration
cat > /tmp/docker-nopasswd << EOF
# Allow passwordless Docker commands for $USER
$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start docker
$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop docker
$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart docker
$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl status docker
$USER ALL=(ALL) NOPASSWD: /usr/bin/service docker start
$USER ALL=(ALL) NOPASSWD: /usr/bin/service docker stop
$USER ALL=(ALL) NOPASSWD: /usr/bin/service docker restart
$USER ALL=(ALL) NOPASSWD: /usr/bin/service docker status
$USER ALL=(ALL) NOPASSWD: /usr/bin/dockerd
$USER ALL=(ALL) NOPASSWD: /usr/sbin/modprobe
$USER ALL=(ALL) NOPASSWD: /usr/sbin/sysctl
$USER ALL=(ALL) NOPASSWD: /usr/sbin/iptables
$USER ALL=(ALL) NOPASSWD: /usr/sbin/ip
$USER ALL=(ALL) NOPASSWD: /usr/bin/pkill dockerd
EOF

# Install the configuration
sudo cp /tmp/docker-nopasswd /etc/sudoers.d/docker-nopasswd
sudo chmod 0440 /etc/sudoers.d/docker-nopasswd
sudo chown root:root /etc/sudoers.d/docker-nopasswd
rm /tmp/docker-nopasswd

# Add user to docker group if not already
if ! groups | grep -q docker; then
    echo "Adding $USER to docker group..."
    sudo usermod -aG docker $USER
fi

# Test the configuration
if sudo -n systemctl status docker >/dev/null 2>&1; then
    echo "✓ Passwordless Docker setup completed successfully!"
else
    echo "⚠ Setup completed, but test failed. You may need to restart WSL."
fi

echo "Setup complete! You may need to restart WSL for all changes to take effect."
echo "Run: wsl --shutdown && wsl -d $wslDistro"
'@

# Execute the setup script
$setupScript | wsl -d $wslDistro --exec bash

Write-Host "`nPasswordless Docker setup completed!" -ForegroundColor Green
Write-Host "Recommendation: Restart WSL to ensure all changes take effect:" -ForegroundColor Yellow
Write-Host "  wsl --shutdown" -ForegroundColor Cyan
Write-Host "  wsl -d $wslDistro" -ForegroundColor Cyan
Write-Host "`nAfter restart, you can run Docker commands without passwords" -ForegroundColor Green
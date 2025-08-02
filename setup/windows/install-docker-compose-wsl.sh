#!/bin/bash
# Install Docker Compose in WSL

echo "Installing Docker Compose in WSL..."

# Docker Compose v2 is included with Docker Engine
# Check if docker compose command works
if docker compose version > /dev/null 2>&1; then
    echo "✓ Docker Compose v2 is already installed"
    echo "  Version: $(docker compose version)"
    exit 0
fi

# Install Docker Compose plugin
echo "Installing Docker Compose plugin..."
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Verify installation
if docker compose version > /dev/null 2>&1; then
    echo "✓ Docker Compose v2 installed successfully"
    echo "  Version: $(docker compose version)"
else
    echo "Installing standalone docker-compose..."
    # Install standalone version as fallback
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for docker-compose
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    echo "✓ Docker Compose standalone installed"
    echo "  Version: $(docker-compose --version)"
fi
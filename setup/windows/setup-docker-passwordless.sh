#!/bin/bash
# Setup passwordless Docker commands in WSL

echo "Setting up passwordless Docker commands..."

# Create sudoers configuration for Docker
sudo tee /etc/sudoers.d/docker-nopasswd << EOF
# Allow passwordless Docker commands
$USER ALL=(ALL) NOPASSWD: /usr/sbin/service docker start
$USER ALL=(ALL) NOPASSWD: /usr/sbin/service docker stop
$USER ALL=(ALL) NOPASSWD: /usr/sbin/service docker restart
$USER ALL=(ALL) NOPASSWD: /usr/sbin/service docker status
$USER ALL=(ALL) NOPASSWD: /usr/bin/dockerd
$USER ALL=(ALL) NOPASSWD: /usr/bin/docker
EOF

# Set correct permissions
sudo chmod 0440 /etc/sudoers.d/docker-nopasswd

# Verify the configuration
if sudo -n service docker status >/dev/null 2>&1; then
    echo "✓ Passwordless Docker setup completed successfully!"
    echo "You can now start Docker without entering a password."
else
    echo "✗ Setup failed. Please check the configuration."
    exit 1
fi

# Add user to docker group if not already added
if ! groups | grep -q docker; then
    echo "Adding $USER to docker group..."
    sudo usermod -aG docker $USER
    echo "✓ User added to docker group."
    echo "Please log out and log back in for group changes to take effect."
fi

echo ""
echo "Setup complete! You can now use start-docker-wsl.bat without password prompts."
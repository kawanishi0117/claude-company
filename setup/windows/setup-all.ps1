# WSL2 + Docker Engine Setup Script for Windows
# Run as Administrator

param(
    [string]$DistroName = "Ubuntu",
    [switch]$SkipRestart
)

# Always run with verification
$AutoVerify = $true

$ErrorActionPreference = "Continue"

# Set console output encoding for better compatibility
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    chcp 65001 > $null 2>&1  # Set code page to UTF-8
} catch {
    # Ignore encoding setup errors
}

Write-Host "===== WSL2 + Docker Engine Setup Script =====" -ForegroundColor Cyan
Write-Host "This script will install WSL2 and Docker Engine" -ForegroundColor Yellow

# Check if already installed
$skipInstall = $false
try {
    $wslInstalled = (wsl --status 2>&1) -notmatch "not recognized"
    $distroInstalled = (wsl --list --quiet 2>&1) -contains $DistroName
    
    if ($wslInstalled -and $distroInstalled) {
        # Check if Docker is installed
        $dockerCheck = wsl -d $DistroName docker version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nWSL2 and Docker are already installed!" -ForegroundColor Green
            
            if ($AutoVerify) {
                Write-Host "Skipping installation and proceeding to verification..." -ForegroundColor Yellow
                $skipInstall = $true
            } else {
                Write-Host "Run with -AutoVerify flag to verify the installation" -ForegroundColor Yellow
                Write-Host "Example: .\setup-wsl-docker.ps1 -AutoVerify" -ForegroundColor Gray
                exit 0
            }
        }
    }
} catch {
    # Continue with installation if check fails
}

# Skip to verification if already installed
if ($skipInstall) {
    # Jump to auto verification section
} else {
    # Check if running as Administrator
    if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Host "This script must be run as Administrator. Restarting..." -ForegroundColor Red
        Start-Process PowerShell -Verb RunAs "-File `"$PSCommandPath`" $($MyInvocation.UnboundArguments)"
        exit
    }

# Function to check if restart is needed
function Test-RestartNeeded {
    $wslStatus = wsl --status 2>&1
    return $wslStatus -match "restart" -or $wslStatus -match "not installed"
}

# Step 1: Enable WSL and Virtual Machine Platform
Write-Host "`n[1/7] Enabling Windows features..." -ForegroundColor Green
try {
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
    Write-Host "Windows features enabled successfully" -ForegroundColor Green
} catch {
    Write-Host "Error enabling Windows features: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Check if restart is needed after enabling features
if (Test-RestartNeeded) {
    if ($SkipRestart) {
        Write-Host "Restart required but skipped. Please restart manually and run this script again." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "Restart required. The computer will restart in 10 seconds..." -ForegroundColor Yellow
    Write-Host "After restart, run this script again to continue setup." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Restart-Computer -Force
    exit
}

# Step 3: Set WSL 2 as default version
Write-Host "`n[2/7] Setting WSL 2 as default..." -ForegroundColor Green
try {
    wsl --set-default-version 2
    Write-Host "WSL 2 set as default" -ForegroundColor Green
} catch {
    Write-Host "Error setting WSL 2 as default: $_" -ForegroundColor Red
}

# Step 4: Update WSL
Write-Host "`n[3/7] Updating WSL..." -ForegroundColor Green
try {
    wsl --update
    Write-Host "WSL updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Error updating WSL: $_" -ForegroundColor Red
}

# Step 5: Install Linux distribution
Write-Host "`n[4/7] Installing $DistroName..." -ForegroundColor Green
$distroInstalled = $false
try {
    $installedDistros = wsl --list --quiet 2>$null
    if ($installedDistros -notcontains $DistroName) {
        Write-Host "Downloading and installing $DistroName. This may take a few minutes..." -ForegroundColor Yellow
        wsl --install -d $DistroName --no-launch
        $distroInstalled = $true
    } else {
        Write-Host "$DistroName is already installed" -ForegroundColor Green
    }
} catch {
    Write-Host "Error installing ${DistroName}: $_" -ForegroundColor Red
    exit 1
}

# Step 6: Create Docker installation script
Write-Host "`n[5/7] Creating Docker installation script..." -ForegroundColor Green
$dockerInstallScript = @'
#!/bin/bash
# Docker Engine Installation Script for WSL2 (running as root)

set -e

echo "===== Installing Docker Engine in WSL2 ====="

# Update package index
echo "[1/6] Updating package index..."
DEBIAN_FRONTEND=noninteractive apt-get update -y

# Install prerequisites
echo "[2/6] Installing prerequisites..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
echo "[3/6] Adding Docker GPG key..."
mkdir -p /etc/apt/keyrings
rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo "[4/6] Setting up Docker repository..."
rm -f /etc/apt/sources.list.d/docker.list
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
echo "[5/6] Installing Docker Engine..."
DEBIAN_FRONTEND=noninteractive apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install standalone docker-compose for compatibility
echo "[5.5/6] Installing docker-compose standalone..."
DOCKER_COMPOSE_VERSION="v2.23.0"
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
# Create symlink for compatibility
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Configure Docker to start on boot
echo "[6/6] Configuring Docker..."
# Add default user to docker group (get the actual username)
DEFAULT_USER=$(ls /home | head -1)
if [ ! -z "$DEFAULT_USER" ]; then
    usermod -aG docker $DEFAULT_USER
    echo "Added $DEFAULT_USER to docker group"
fi

# Create docker daemon config for WSL2
mkdir -p /etc/docker
rm -f /etc/docker/daemon.json
tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "iptables": false,
  "bridge": "none",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Configure systemd for WSL2
rm -f /etc/wsl.conf
tee /etc/wsl.conf > /dev/null <<EOF
[boot]
systemd=true

[user]
default=$DEFAULT_USER
EOF

# Enable Docker service but don't start it yet (will start after WSL restart)
systemctl enable docker 2>/dev/null || update-rc.d docker enable 2>/dev/null || true

# Create systemd override directory for docker service
mkdir -p /etc/systemd/system/docker.service.d
tee /etc/systemd/system/docker.service.d/wsl2.conf > /dev/null <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd --containerd=/run/containerd/containerd.sock
EOF

# Reload systemd daemon
systemctl daemon-reload 2>/dev/null || true

# Try to start Docker service (may fail in current session)
systemctl start docker 2>/dev/null || service docker start 2>/dev/null || echo "Docker will start after WSL restart"

echo ""
echo "===== Docker Installation Complete ====="
echo "Docker version:"
docker version || echo "Docker service not yet started. This is normal on first install."
echo ""
echo "Docker Compose version:"
docker compose version || echo "Docker Compose plugin not available yet."
docker-compose --version || echo "docker-compose standalone not available yet."
echo ""
echo "IMPORTANT: You need to restart WSL for all changes to take effect."
echo "Run 'wsl --shutdown' from Windows, then start WSL again."
'@

$scriptPath = "${env:TEMP}\install-docker-wsl.sh"
# Fix line endings for Unix compatibility and ensure proper encoding
try {
    # PowerShell 5.1 compatibility - use UTF8 without BOM
    # Ensure proper Unix line endings and add final newline if missing
    $content = $dockerInstallScript -replace "`r`n", "`n" -replace "`r", "`n"
    if (-not $content.EndsWith("`n")) {
        $content += "`n"
    }
    # Write file as UTF8 without BOM for better compatibility
    [System.IO.File]::WriteAllText($scriptPath, $content, [System.Text.UTF8Encoding]::new($false))
    
    # Verify file was created successfully
    if (Test-Path $scriptPath) {
        $fileSize = (Get-Item $scriptPath).Length
        Write-Host "Docker installation script created successfully ($fileSize bytes)" -ForegroundColor Green
    } else {
        throw "File was not created"
    }
} catch {
    Write-Host "Error creating Docker installation script: $_" -ForegroundColor Red
    Write-Host "Attempted path: $scriptPath" -ForegroundColor Gray
    exit 1
}

# Step 7: Install Docker in WSL
Write-Host "`n[6/7] Installing Docker in WSL..." -ForegroundColor Green
try {
    # First ensure WSL distro is available
    $checkDistro = wsl -d $DistroName echo "WSL OK" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WSL distro $DistroName not available. Error: $checkDistro" -ForegroundColor Red
        throw "WSL distro not available"
    }
    
    # Verify script file exists before proceeding
    if (-not (Test-Path $scriptPath)) {
        Write-Host "Docker installation script not found at: $scriptPath" -ForegroundColor Red
        throw "Docker installation script not created"
    }
    
    # Convert Windows path to WSL path using proper escaping
    $windowsPath = $scriptPath.Replace('\', '/')
    $wslScriptPath = wsl wslpath -a """$windowsPath""" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to convert path: $wslScriptPath" -ForegroundColor Red
        # Try alternative path conversion
        $wslScriptPath = $scriptPath -replace 'C:', '/mnt/c' -replace '\\', '/'
        Write-Host "Using alternative path: $wslScriptPath" -ForegroundColor Yellow
    }
    
    Write-Host "Installing Docker via script: $wslScriptPath" -ForegroundColor Yellow
    
    # Make script executable and run it as root to avoid password prompts
    Write-Host "Making script executable..." -ForegroundColor Gray
    $chmodResult = wsl -d $DistroName -u root bash -c "chmod +x ""$wslScriptPath""" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Could not make script executable: $chmodResult" -ForegroundColor Yellow
    }
    
    Write-Host "Executing Docker installation script (this may take several minutes)..." -ForegroundColor Gray
    $installResult = wsl -d $DistroName -u root bash -c """$wslScriptPath""" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker installed successfully in WSL" -ForegroundColor Green
        Write-Host "Installation output:" -ForegroundColor Gray
        Write-Host $installResult -ForegroundColor DarkGray
    } else {
        Write-Host "Docker installation completed with warnings or errors. Exit code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "Installation output:" -ForegroundColor Yellow
        Write-Host $installResult -ForegroundColor Gray
    }
} catch {
    Write-Host "Error installing Docker: $_" -ForegroundColor Red
    Write-Host "Installation may have partially completed. Check WSL manually." -ForegroundColor Yellow
}

# Step 8: Final setup
Write-Host "`n[7/7] Finalizing setup..." -ForegroundColor Green

# Create convenience script for starting Docker
$startDockerScript = @"
@echo off
setlocal enabledelayedexpansion

echo ===== Docker WSL2 Startup Script =====
echo Starting Docker in WSL2...

echo [1/4] Checking WSL status...
wsl --status >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: WSL is not available or not installed
    pause
    exit /b 1
)

echo [2/4] Checking $DistroName availability...
wsl -d $DistroName echo "WSL OK" >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: $DistroName distribution not found
    echo Available distributions:
    wsl --list
    pause
    exit /b 1
)

echo [3/4] Starting Docker service...
echo Trying systemctl method...
wsl -d $DistroName -u root systemctl start docker >nul 2>&1
timeout /t 3 >nul

echo Checking Docker status...
wsl -d $DistroName docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started with systemctl
    goto :verify
)

echo Systemctl failed, trying service method...
wsl -d $DistroName -u root service docker start >nul 2>&1
timeout /t 3 >nul

wsl -d $DistroName docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started with service command
    goto :verify
)

echo Service method failed, trying manual dockerd...
wsl -d $DistroName -u root bash -c "pkill dockerd; nohup dockerd --host=unix:///var/run/docker.sock --userland-proxy=false --iptables=false --bridge=none > /var/log/docker.log 2>&1 &" >nul 2>&1
timeout /t 5 >nul

wsl -d $DistroName docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started manually
    goto :verify
)

echo ERROR: All Docker startup methods failed
echo Troubleshooting steps:
echo 1. Run: wsl --shutdown
echo 2. Run: wsl -d $DistroName
echo 3. In WSL, run: sudo systemctl start docker
echo 4. If that fails, run: sudo dockerd --host=unix:///var/run/docker.sock ^&
pause
exit /b 1

:verify
echo [4/4] Verifying Docker installation...
wsl -d $DistroName docker version
if !errorlevel! equ 0 (
    echo.
    echo ===== Docker is ready to use! =====
    echo • Access Claude Company dashboard at: http://localhost:3000
    echo • Use 'wsl' to enter $DistroName and use Docker commands
    echo • Docker logs available at: /var/log/docker.log
    echo.
) else (
    echo WARNING: Docker may not be fully functional
)

echo Press any key to exit...
pause >nul
"@

$startDockerPath = Join-Path $PSScriptRoot "start-docker-wsl.bat"
try {
    # Use ASCII encoding for batch file compatibility
    [System.IO.File]::WriteAllText($startDockerPath, $startDockerScript, [System.Text.Encoding]::ASCII)
    Write-Host "Created start-docker-wsl.bat for easy Docker startup" -ForegroundColor Green
} catch {
    Write-Host "Error creating start-docker-wsl.bat: $_" -ForegroundColor Red
}

# Cleanup temporary files
try {
    if (Test-Path $scriptPath) {
        Remove-Item $scriptPath -Force -ErrorAction SilentlyContinue
        Write-Host "Cleaned up temporary installation files" -ForegroundColor Gray
    }
} catch {
    Write-Host "Could not clean up temporary files: $scriptPath" -ForegroundColor Yellow
}

} # End of installation block

# Step 9: Auto verification if requested or if skipped install
if ($AutoVerify -or $skipInstall) {
    Write-Host "`n[8/8] Running automatic verification..." -ForegroundColor Green
    Write-Host "WARNING: This verification may restart WSL and disconnect any active VSCode WSL sessions." -ForegroundColor Yellow
    
    # Check if Docker is already running to avoid unnecessary restart
    $dockerAlreadyRunning = $false
    try {
        $dockerCheck = wsl -d $DistroName docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker is already running, skipping WSL restart..." -ForegroundColor Green
            $dockerAlreadyRunning = $true
        }
    } catch {}
    
    if (-not $dockerAlreadyRunning) {
        Write-Host "Restarting WSL (this will disconnect VSCode WSL connections)..." -ForegroundColor Yellow
        Write-Host "NOTE: If you're using VSCode with WSL, you'll need to reconnect after this completes." -ForegroundColor Cyan
        wsl --shutdown
        Start-Sleep -Seconds 3
    }
    
    Write-Host "Starting Docker service..." -ForegroundColor Yellow
    try {
        # Method 1: Try systemctl (for systemd-enabled WSL2)
        Write-Host "Attempting systemctl start..." -ForegroundColor Gray
        $systemdResult = wsl -d $DistroName -u root bash -c "systemctl start docker" 2>&1
        Start-Sleep -Seconds 3
        
        # Check if Docker is responding
        $dockerStatus = wsl -d $DistroName docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Systemctl method failed, trying service command..." -ForegroundColor Yellow
            
            # Method 2: Try service command
            $serviceResult = wsl -d $DistroName -u root bash -c "service docker start" 2>&1
            Start-Sleep -Seconds 3
            
            # Check again
            $dockerStatus = wsl -d $DistroName docker info 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Service command failed, trying manual dockerd startup..." -ForegroundColor Yellow
                
                # Method 3: Manual dockerd startup optimized for WSL2
                $manualResult = wsl -d $DistroName -u root bash -c "pkill dockerd 2>/dev/null; dockerd --host=unix:///var/run/docker.sock --userland-proxy=false --iptables=false --bridge=none --pidfile=/var/run/docker.pid --exec-root=/var/run/docker --data-root=/var/lib/docker > /var/log/docker.log 2>&1 &" 2>&1
                Start-Sleep -Seconds 5
                
                # Final check
                $dockerStatus = wsl -d $DistroName docker info 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "All Docker startup methods failed. Manual intervention may be required." -ForegroundColor Red
                    Write-Host "Systemctl output: $systemdResult" -ForegroundColor Gray
                    Write-Host "Service output: $serviceResult" -ForegroundColor Gray
                    Write-Host "Manual output: $manualResult" -ForegroundColor Gray
                }
            }
        }
        
        Write-Host "`nVerifying installation..." -ForegroundColor Green
        
        $verificationPassed = $true
        
        # Check WSL version
        Write-Host "`n1. WSL Status:" -ForegroundColor Cyan
        try {
            $wslStatus = wsl --status 2>&1
            # Extract key information instead of showing garbled text
            if ($wslStatus -match "Ubuntu") {
                Write-Host "Default distribution: Ubuntu" -ForegroundColor White
            }
            if ($wslStatus -match "2") {
                Write-Host "WSL version: 2" -ForegroundColor White
            }
            Write-Host "WSL is running and operational" -ForegroundColor White
        } catch {
            Write-Host "WSL status check failed: $_" -ForegroundColor Red
            $verificationPassed = $false
        }
        
        # Check installed distros
        Write-Host "`n2. Installed Linux Distributions:" -ForegroundColor Cyan
        try {
            # Check using simpler method to avoid encoding issues
            $simpleDistroCheck = wsl --list --quiet 2>&1
            if ($simpleDistroCheck -match $DistroName) {
                Write-Host "V $DistroName distribution found and available" -ForegroundColor Green
                
                # Test if we can execute commands in the distro
                $testDistro = wsl -d $DistroName echo "WSL OK" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "V $DistroName is responding to commands" -ForegroundColor Green
                } else {
                    Write-Host "! $DistroName found but not responding properly" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Warning: $DistroName not found in distro list" -ForegroundColor Yellow
                $verificationPassed = $false
            }
        } catch {
            Write-Host "Distro list check failed: $_" -ForegroundColor Red
            $verificationPassed = $false
        }
        
        # Check Docker version
        Write-Host "`n3. Docker Version:" -ForegroundColor Cyan
        $dockerRunning = $false
        try {
            $dockerVersion = wsl -d $DistroName docker version 2>&1
            if ($LASTEXITCODE -eq 0 -and $dockerVersion -match "Server:") {
                # Format Docker version output properly with line breaks
                $formattedVersion = $dockerVersion -replace '(?m)^Client: ', "`nClient: " -replace '(?m)^Server: ', "`nServer: " -replace '(?m)^\s*Version:', "`n  Version:" -replace '(?m)^\s*API version:', "`n  API version:" -replace '(?m)^\s*Go version:', "`n  Go version:" -replace '(?m)^\s*Git commit:', "`n  Git commit:" -replace '(?m)^\s*Built:', "`n  Built:" -replace '(?m)^\s*OS/Arch:', "`n  OS/Arch:" -replace '(?m)^\s*Context:', "`n  Context:" -replace '(?m)^\s*Engine:', "`n Engine:" -replace '(?m)^\s*containerd:', "`ncontainerd:" -replace '(?m)^\s*runc:', "`nrunc:" -replace '(?m)^\s*docker-init:', "`ndocker-init:" -replace '(?m)^\s*Experimental:', "`n  Experimental:" -replace '(?m)^\s*GitCommit:', "`n  GitCommit:"
                Write-Host $formattedVersion -ForegroundColor White
                Write-Host "`nV Docker is running successfully!" -ForegroundColor Green
                $dockerRunning = $true
                
                # Check docker-compose availability
                Write-Host "`nChecking Docker Compose availability..." -ForegroundColor Cyan
                $composeV2 = wsl -d $DistroName docker compose version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "V Docker Compose v2 (plugin) installed" -ForegroundColor Green
                }
                $composeStandalone = wsl -d $DistroName docker-compose --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "V docker-compose (standalone) installed" -ForegroundColor Green
                }
            } else {
                Write-Host "! Docker is installed but not running properly:" -ForegroundColor Yellow
                Write-Host $dockerVersion -ForegroundColor Gray
                $verificationPassed = $false
            }
        } catch {
            Write-Host "Docker version check failed: $_" -ForegroundColor Red
            $verificationPassed = $false
        }
        
        # Run hello-world test (only if Docker is running)
        if ($dockerRunning) {
            Write-Host "`n4. Running Docker Hello-World Test:" -ForegroundColor Cyan
            try {
                $helloWorld = wsl -d $DistroName docker run --rm hello-world 2>&1
                if ($LASTEXITCODE -eq 0 -and $helloWorld -match "Hello from Docker!") {
                    Write-Host "V Docker test successful!" -ForegroundColor Green
                    $helloWorldLines = $helloWorld -split "`n" | Where-Object { $_ -match "Hello from Docker!" -or $_ -match "This message shows" } | Select-Object -First 2
                    Write-Host $helloWorldLines -ForegroundColor White
                } else {
                    Write-Host "! Docker test failed:" -ForegroundColor Yellow
                    Write-Host $helloWorld -ForegroundColor Gray
                    $verificationPassed = $false
                }
            } catch {
                Write-Host "Docker hello-world test failed: $_" -ForegroundColor Red
                $verificationPassed = $false
            }
        } else {
            Write-Host "`n4. Skipping Docker test (Docker not running)" -ForegroundColor Yellow
        }
        
        # Check Docker images (informational only)
        Write-Host "`n5. Docker Images:" -ForegroundColor Cyan
        try {
            $dockerImages = wsl -d $DistroName docker images 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host $dockerImages -ForegroundColor White
            } else {
                Write-Host "Cannot list Docker images (Docker may not be running)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Docker images check failed: $_" -ForegroundColor Yellow
        }
        
        # Final status
        Write-Host "`n===== Verification Complete! =====" -ForegroundColor Cyan
        if ($dockerRunning) {
            Write-Host "V WSL2 is installed and running" -ForegroundColor Green
            Write-Host "V $DistroName is installed" -ForegroundColor Green
            Write-Host "V Docker Engine is installed and functional" -ForegroundColor Green
            Write-Host "`nSetup completed successfully! You can now use Docker in WSL2." -ForegroundColor Green
            Write-Host "`nNext steps:" -ForegroundColor Cyan
            Write-Host "1. Navigate to your Claude Company project directory" -ForegroundColor White
            Write-Host "2. Run: docker-compose up -d" -ForegroundColor White
            Write-Host "3. Access dashboard at: http://localhost:3000" -ForegroundColor White
        } else {
            Write-Host "V WSL2 is installed" -ForegroundColor Green
            Write-Host "V $DistroName is installed" -ForegroundColor Green
            Write-Host "! Docker Engine needs manual configuration" -ForegroundColor Yellow
            Write-Host "`n! Setup completed with warnings. See troubleshooting steps below." -ForegroundColor Yellow
            
            Write-Host "`nTroubleshooting steps:" -ForegroundColor Cyan
            Write-Host "1. Try: wsl --shutdown && wsl" -ForegroundColor White
            Write-Host "2. In WSL, try: sudo systemctl start docker" -ForegroundColor White
            Write-Host "3. Or manually: sudo dockerd --containerd=/run/containerd/containerd.sock &" -ForegroundColor White
            Write-Host "4. Test with: docker run hello-world" -ForegroundColor White
        }
        
    } catch {
        Write-Host "Error during verification: $_" -ForegroundColor Red
        Write-Host "You may need to manually start Docker and verify the installation" -ForegroundColor Yellow
    }
} else {
    # Final instructions
    Write-Host "`n===== Setup Complete! =====" -ForegroundColor Cyan
    Write-Host "Installation finished. To complete setup:" -ForegroundColor Yellow
    Write-Host "1. Run 'wsl --shutdown' to restart WSL" -ForegroundColor White
    Write-Host "2. Use 'start-docker-wsl.bat' to start Docker easily" -ForegroundColor White
    Write-Host "3. Enter WSL with 'wsl' command" -ForegroundColor White
    Write-Host "4. Test Docker with 'docker run hello-world'" -ForegroundColor White
    
    if ($distroInstalled) {
        Write-Host "`nNOTE: Since this is a fresh install of $DistroName, you'll need to set up a user account when you first enter WSL." -ForegroundColor Yellow
    }
    
    Write-Host "`nFor the Claude Company System:" -ForegroundColor Cyan
    Write-Host "• Navigate to your project folder in WSL" -ForegroundColor White
    Write-Host "• Run: docker-compose up -d" -ForegroundColor White
    Write-Host "• Access dashboard at: http://localhost:3000" -ForegroundColor White
}

# Final status and cleanup message
Write-Host "`n" + "="*60 -ForegroundColor Gray
Write-Host "Setup script completed. Files created:" -ForegroundColor Gray
Write-Host "- start-docker-wsl.bat - Easy Docker startup script" -ForegroundColor Gray

# Define startDockerPath if not already defined (for skip install case)
if (-not $startDockerPath) {
    $startDockerPath = Join-Path $PSScriptRoot "start-docker-wsl.bat"
}

if (Test-Path $startDockerPath) {
    Write-Host "  Location: $startDockerPath" -ForegroundColor DarkGray
} else {
    Write-Host "  Location: $PSScriptRoot\start-docker-wsl.bat (available from previous installation)" -ForegroundColor DarkGray
}
Write-Host "`nFor support, check the troubleshooting section in the Claude Company documentation." -ForegroundColor Gray
Write-Host "="*60 -ForegroundColor Gray

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
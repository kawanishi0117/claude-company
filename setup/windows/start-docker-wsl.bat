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

echo [2/4] Checking Ubuntu availability...
wsl -d Ubuntu echo "WSL OK" >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: Ubuntu distribution not found
    echo Available distributions:
    wsl --list
    pause
    exit /b 1
)

echo [3/4] Starting Docker service...
echo Trying systemctl method...
wsl -d Ubuntu -u root systemctl start docker >nul 2>&1
timeout /t 3 >nul

echo Checking Docker status...
wsl -d Ubuntu docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started with systemctl
    goto :verify
)

echo Systemctl failed, trying service method...
wsl -d Ubuntu -u root service docker start >nul 2>&1
timeout /t 3 >nul

wsl -d Ubuntu docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started with service command
    goto :verify
)

echo Service method failed, trying manual dockerd...
wsl -d Ubuntu -u root bash -c "pkill dockerd; nohup dockerd --host=unix:///var/run/docker.sock --userland-proxy=false --iptables=false --bridge=none > /var/log/docker.log 2>&1 &" >nul 2>&1
timeout /t 5 >nul

wsl -d Ubuntu docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo SUCCESS: Docker started manually
    goto :verify
)

echo ERROR: All Docker startup methods failed
echo Troubleshooting steps:
echo 1. Run: wsl --shutdown
echo 2. Run: wsl -d Ubuntu
echo 3. In WSL, run: sudo systemctl start docker
echo 4. If that fails, run: sudo dockerd --host=unix:///var/run/docker.sock ^&
pause
exit /b 1

:verify
echo [4/4] Verifying Docker installation...
wsl -d Ubuntu docker version
if !errorlevel! equ 0 (
    echo.
    echo ===== Docker is ready to use! =====
    echo ?? Access Claude Company dashboard at: http://localhost:3000
    echo ?? Use 'wsl' to enter Ubuntu and use Docker commands
    echo ?? Docker logs available at: /var/log/docker.log
    echo.
) else (
    echo WARNING: Docker may not be fully functional
)

echo Press any key to exit...
pause >nul
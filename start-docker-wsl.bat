@echo off
echo === Starting WSL2 and Docker Engine ===

REM Check if WSL is running
wsl --status > nul 2>&1
if errorlevel 1 (
    echo Starting WSL2...
    wsl --distribution Ubuntu --exec echo "WSL started"
) else (
    echo WSL2 is already running
)

REM Check if passwordless setup exists
wsl --distribution Ubuntu --exec "sudo -n service docker status" > nul 2>&1
if errorlevel 1 (
    echo.
    echo [INFO] Password required for Docker commands.
    echo To setup passwordless Docker, run in WSL:
    echo   cd /mnt/c/pg/claude-company/setup/windows
    echo   bash setup-docker-passwordless.sh
    echo.
)

REM Start Docker daemon in WSL
echo Starting Docker Engine in WSL...
wsl --distribution Ubuntu --exec sudo service docker start

REM Wait for Docker to be ready
echo Waiting for Docker Engine to be ready...
timeout /t 5 /nobreak > nul

REM Check Docker status
wsl --distribution Ubuntu --exec docker version > nul 2>&1
if errorlevel 1 (
    echo Docker Engine failed to start
    echo Trying to start dockerd directly...
    start /b wsl --distribution Ubuntu --exec sudo dockerd
    timeout /t 10 /nobreak > nul
) else (
    echo Docker Engine is running
)

REM Verify Docker is accessible
wsl --distribution Ubuntu --exec docker ps > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Engine is not responding
    echo Please check Docker installation in WSL
    pause
    exit /b 1
) else (
    echo Docker Engine is ready!
)

echo.
echo You can now run start.ps1 to start Claude Company System
pause
@echo off
echo === Setting up Docker CLI for Windows to connect to WSL Docker ===

REM Get WSL IP address
for /f "tokens=*" %%i in ('wsl hostname -I') do set WSL_IP=%%i
set WSL_IP=%WSL_IP: =%

echo WSL IP: %WSL_IP%

REM Set Docker host environment variable
setx DOCKER_HOST "tcp://%WSL_IP%:2375"
set DOCKER_HOST=tcp://%WSL_IP%:2375

echo.
echo Docker CLI will now connect to WSL Docker Engine at %DOCKER_HOST%
echo.
echo IMPORTANT: You need to enable Docker API in WSL:
echo 1. Open WSL terminal
echo 2. Edit Docker daemon config:
echo    sudo nano /etc/docker/daemon.json
echo 3. Add:
echo    {
echo      "hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]
echo    }
echo 4. Restart Docker:
echo    sudo service docker restart
echo.
pause
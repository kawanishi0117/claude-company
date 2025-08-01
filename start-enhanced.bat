@echo off
setlocal enabledelayedexpansion

REM Enhanced Claude Company System - Batch Startup Script
REM Comprehensive startup script with health checks and monitoring

set "SKIP_HEALTH_CHECK="
set "DEVELOPMENT="
set "REPLICAS="
set "NO_CACHE="
set "VERBOSE="

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :start
if /I "%~1"=="--skip-health" set "SKIP_HEALTH_CHECK=1"
if /I "%~1"=="--development" set "DEVELOPMENT=1"
if /I "%~1"=="--replicas" set "REPLICAS=%~2" & shift
if /I "%~1"=="--no-cache" set "NO_CACHE=1"
if /I "%~1"=="--verbose" set "VERBOSE=1"
if /I "%~1"=="--help" goto :show_help
shift
goto :parse_args

:show_help
echo.
echo Claude Company System Startup Script
echo.
echo Usage: start-enhanced.bat [OPTIONS]
echo.
echo Options:
echo   --skip-health     Skip health checks after startup
echo   --development     Enable development mode with debug logging  
echo   --replicas N      Set number of subordinate AI replicas (default: 3)
echo   --no-cache        Build containers without cache
echo   --verbose         Enable verbose build output
echo   --help            Show this help message
echo.
goto :end

:start
call :show_banner
call :test_prerequisites
call :initialize_environment
call :initialize_directories
call :build_system
call :start_services
call :test_service_health
call :show_system_info
call :start_dashboard

echo.
echo [SUCCESS] Claude Company System startup completed successfully!
echo [INFO] The system is running in the background. Check the dashboard for real-time status.
echo.
goto :end

:show_banner
echo.
echo ================================================================
echo                Claude Company System v2.0
echo          AI-Powered Development Automation Platform
echo ================================================================
echo.
goto :eof

:test_prerequisites
echo [STEP] Checking prerequisites...

REM Check Docker
docker --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo [INFO] Please install Docker Desktop from https://www.docker.com/products/docker-desktop  
    pause
    exit /b 1
)
echo [SUCCESS] Docker is installed

REM Check Docker Compose
docker-compose --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Docker Compose is not available
    pause
    exit /b 1
)
echo [SUCCESS] Docker Compose is available

REM Check if Docker daemon is running
docker info >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Docker daemon is not running. Please start Docker Desktop.
    echo [INFO] Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo [INFO] Waiting for Docker to start (this may take a few minutes)...
    
    set /a timeout=120
    set /a elapsed=0
    
    :wait_docker
    if !elapsed! geq !timeout! (
        echo [ERROR] Docker failed to start within !timeout! seconds
        pause
        exit /b 1
    )
    
    timeout /t 5 /nobreak >nul
    set /a elapsed+=5
    docker info >nul 2>&1
    if !errorlevel! neq 0 (
        echo|set /p="."
        goto :wait_docker
    )
    echo.
    echo [SUCCESS] Docker daemon is now running
)
echo [SUCCESS] Docker daemon is running

REM Check disk space (rough estimate)
for /f "tokens=3" %%a in ('dir /-c "%SystemDrive%\" ^| find "bytes free"') do set "freespace=%%a"
echo [SUCCESS] System check completed
goto :eof

:initialize_environment
echo [STEP] Initializing environment configuration...

if not exist ".env" (
    if exist ".env.example" (
        echo [WARNING] .env file not found. Creating from .env.example...
        copy ".env.example" ".env" >nul
        echo [SUCCESS] Created .env file
        echo [INFO] Opening .env file for configuration...
        notepad .env
        echo [WARNING] Please configure your ANTHROPIC_API_KEY and other settings
        echo Press any key after configuring .env to continue...
        pause >nul
    ) else (
        echo [ERROR] Neither .env nor .env.example found
        echo [INFO] Creating basic .env file...
        (
            echo # Claude Company System Environment Configuration
            echo ANTHROPIC_API_KEY=your_claude_api_key_here
            echo SUBORDINATE_REPLICAS=3
            echo LOG_LEVEL=info
            echo NODE_ENV=production
            echo REDIS_PASSWORD=claudecompany
            echo REDIS_URL=redis://redis:6379
            echo REACT_APP_API_URL=http://localhost:8000
            echo REACT_APP_WS_URL=ws://localhost:8000
            echo ES_JAVA_OPTS=-Xms512m -Xmx512m
            echo COMPOSE_PROJECT_NAME=claude-company-system
        ) > .env
        echo [SUCCESS] Created basic .env file
        notepad .env
        echo Press any key after configuring .env to continue...
        pause >nul
    )
)

REM Basic validation of API key
findstr /C:"ANTHROPIC_API_KEY=your_claude_api_key_here" .env >nul
if !errorlevel! equ 0 (
    echo [ERROR] Invalid ANTHROPIC_API_KEY in .env file
    echo [INFO] Your API key should start with 'sk-ant-' and be from your Anthropic account
    echo [INFO] Get your API key from: https://console.anthropic.com/
    notepad .env
    echo Press any key after setting your API key to continue...
    pause >nul
    
    REM Re-validate
    findstr /C:"ANTHROPIC_API_KEY=your_claude_api_key_here" .env >nul
    if !errorlevel! equ 0 (
        echo [ERROR] API key still invalid. Exiting.
        pause
        exit /b 1
    )
)

echo [SUCCESS] Environment configuration validated

REM Set replicas if specified
if defined REPLICAS (
    powershell -Command "(Get-Content '.env') -replace 'SUBORDINATE_REPLICAS=\d+', 'SUBORDINATE_REPLICAS=%REPLICAS%' | Set-Content '.env'"
    echo [SUCCESS] Set SUBORDINATE_REPLICAS to %REPLICAS%
)

REM Set development mode if specified  
if defined DEVELOPMENT (
    powershell -Command "(Get-Content '.env') -replace 'NODE_ENV=production', 'NODE_ENV=development' | Set-Content '.env'"
    powershell -Command "(Get-Content '.env') -replace 'LOG_LEVEL=info', 'LOG_LEVEL=debug' | Set-Content '.env'"
    echo [SUCCESS] Enabled development mode with debug logging
)

goto :eof

:initialize_directories
echo [STEP] Creating necessary directories...

set "dirs=logs logs\boss logs\subordinate logs\dashboard logs\redis logs\elasticsearch data data\redis data\elasticsearch"

for %%d in (!dirs!) do (
    if not exist "%%d" (
        mkdir "%%d" >nul 2>&1
        echo [SUCCESS] Created directory: %%d
    )
)
goto :eof

:build_system
echo [STEP] Building Docker containers...

set "build_cmd=docker-compose build"
if defined NO_CACHE set "build_cmd=!build_cmd! --no-cache"
if defined VERBOSE set "build_cmd=!build_cmd! --progress=plain"

echo [INFO] Running: !build_cmd!
!build_cmd!

if !errorlevel! neq 0 (
    echo [ERROR] Failed to build containers
    pause
    exit /b 1
)

echo [SUCCESS] Containers built successfully
goto :eof

:start_services
echo [STEP] Starting Claude Company System services...

REM Get replica count from .env
for /f "tokens=2 delims==" %%a in ('findstr "SUBORDINATE_REPLICAS=" .env 2^>nul') do set "env_replicas=%%a"
if not defined env_replicas set "env_replicas=3"

echo [INFO] Starting with !env_replicas! subordinate AI replicas

REM Start core services first
echo [INFO] Starting core infrastructure (Redis, Elasticsearch)...
docker-compose up -d redis elasticsearch

if !errorlevel! neq 0 (
    echo [ERROR] Failed to start core services
    pause
    exit /b 1
)

REM Wait for core services
echo [INFO] Waiting for core services to initialize...
timeout /t 15 /nobreak >nul

REM Start application services
echo [INFO] Starting application services...
docker-compose up -d --scale subordinate-controller=!env_replicas!

if !errorlevel! neq 0 (
    echo [ERROR] Failed to start application services
    pause
    exit /b 1
)

echo [SUCCESS] All services started
goto :eof

:test_service_health
if defined SKIP_HEALTH_CHECK (
    echo [WARNING] Skipping health checks
    goto :eof
)

echo [STEP] Performing health checks...

REM Simple health checks
call :check_port "Redis" 6379 30
call :check_port "Dashboard" 3000 60
call :check_port "Boss Controller API" 8000 45
call :check_port "Elasticsearch" 9200 60
call :check_port "Kibana" 5601 90

echo [INFO] Checking container status...
docker-compose ps

goto :eof

:check_port
set "service_name=%~1"
set "port=%~2"
set "timeout=%~3"

echo [INFO] Checking %service_name% (port %port%)...

set /a elapsed=0
:check_loop
if !elapsed! geq %timeout% (
    echo [ERROR] %service_name% failed health check (timeout: %timeout%s)
    goto :eof
)

netstat -an | find ":%port% " | find "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [SUCCESS] %service_name% is healthy
    goto :eof
)

timeout /t 3 /nobreak >nul
set /a elapsed+=3
echo|set /p="."

goto :check_loop

:show_system_info
echo.
echo ================================================================
echo                    System Started Successfully!
echo ================================================================
echo.
echo Access Points:
echo    Dashboard:        http://localhost:3000
echo    API Endpoint:     http://localhost:8000  
echo    Kibana (Logs):    http://localhost:5601
echo    Redis:            localhost:6379
echo.
echo Management Commands:
echo    View all logs:    docker-compose logs -f
echo    View boss logs:   docker-compose logs -f boss-controller
echo    View sub logs:    docker-compose logs -f subordinate-controller
echo    Scale subordinates: docker-compose up -d --scale subordinate-controller=5
echo    Stop system:      docker-compose down
echo    Restart system:   docker-compose restart
echo.

REM Show container count
for /f %%i in ('docker-compose ps -q ^| find /c /v ""') do set "container_count=%%i"
echo System Status:
echo    Running containers: !container_count!

for /f %%i in ('docker-compose ps subordinate-controller -q ^| find /c /v ""') do set "subordinate_count=%%i"
echo    Subordinate AIs:    !subordinate_count!
echo.

goto :eof

:start_dashboard
echo [STEP] Opening dashboard in browser...

timeout /t 3 /nobreak >nul

start http://localhost:3000
echo [SUCCESS] Dashboard opened in browser
goto :eof

:end
if not defined CI (
    echo.
    pause
)
endlocal
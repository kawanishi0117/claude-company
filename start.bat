@echo off
REM Claude Company System - Batch Startup Script
REM Windows Command Prompt startup script for Claude Company System

echo === Claude Company System Startup ===
echo Initializing Docker environment...

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)
echo + Docker is running

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.example" (
        echo X .env file not found. Creating from .env.example...
        copy ".env.example" ".env" >nul
        echo + Created .env file. Please edit it with your ANTHROPIC_API_KEY
        echo Opening .env file for editing...
        notepad .env
        echo Press any key after setting your API key to continue...
        pause >nul
    ) else (
        echo X Neither .env nor .env.example found. Please create .env file with ANTHROPIC_API_KEY
        pause
        exit /b 1
    )
)

REM Validate API key (basic check)
findstr /C:"ANTHROPIC_API_KEY=your_claude_api_key_here" .env >nul
if %errorlevel% equ 0 (
    echo X Please set a valid ANTHROPIC_API_KEY in .env file
    notepad .env
    echo Press any key after setting your API key to continue...
    pause >nul
)

echo + Environment configuration validated

REM Create necessary directories
if not exist "logs" mkdir logs
if not exist "logs\boss" mkdir logs\boss
if not exist "logs\subordinate" mkdir logs\subordinate
echo + Created log directories

REM Pull latest images
echo Pulling latest Docker images...
docker-compose pull

REM Build containers
echo Building Docker containers...
docker-compose build --no-cache

REM Start services
echo Starting Claude Company System...
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 30 /nobreak >nul

REM Check service health
echo Checking service health...
docker-compose ps

echo.
echo === Claude Company System Started ===
echo Dashboard: http://localhost:3000
echo API: http://localhost:8000
echo Kibana (Logs): http://localhost:5601
echo Redis: localhost:6379
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.

REM Open dashboard in browser
echo Opening dashboard in browser...
start http://localhost:3000

pause
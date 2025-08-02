# Fix Docker WSL Integration
Write-Host "=== Fixing Docker WSL Integration ===" -ForegroundColor Green

# Option 1: Use Docker in WSL directly
Write-Host "Option 1: Running docker-compose inside WSL" -ForegroundColor Yellow

# Check if docker-compose.yml exists
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Error: docker-compose.yml not found in current directory" -ForegroundColor Red
    exit 1
}

# Convert Windows path to WSL path
$currentPath = (Get-Location).Path
$wslPath = "/mnt/" + $currentPath.ToLower().Replace(":\", "/").Replace("\", "/")

Write-Host "Starting services in WSL at: $wslPath" -ForegroundColor Cyan

# Run docker-compose in WSL
wsl --distribution Ubuntu --exec bash -c "cd '$wslPath' && docker-compose up -d"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Services started successfully in WSL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "API: http://localhost:8000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view logs: wsl -d Ubuntu -e docker-compose logs -f" -ForegroundColor Yellow
    Write-Host "To stop: wsl -d Ubuntu -e docker-compose down" -ForegroundColor Yellow
} else {
    Write-Host "✗ Failed to start services" -ForegroundColor Red
    exit 1
}
#!/usr/bin/env pwsh
# Test Individual Docker Builds

Write-Host "Testing Individual Docker Builds..." -ForegroundColor Cyan

# Test Dashboard Build
Write-Host "`n=== Testing Dashboard Build ===" -ForegroundColor Yellow
try {
    docker build -t test-dashboard -f dashboard/Dockerfile dashboard/
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dashboard build successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Dashboard build failed" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Dashboard build error: $_" -ForegroundColor Red
}

# Test Boss Controller Build
Write-Host "`n=== Testing Boss Controller Build ===" -ForegroundColor Yellow
try {
    docker build -t test-boss-controller -f docker/boss-ai/Dockerfile docker/boss-ai/
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Boss Controller build successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Boss Controller build failed" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Boss Controller build error: $_" -ForegroundColor Red
}

# Test Subordinate Controller Build
Write-Host "`n=== Testing Subordinate Controller Build ===" -ForegroundColor Yellow
try {
    docker build -t test-subordinate-controller -f docker/subordinate-ai/Dockerfile docker/subordinate-ai/
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Subordinate Controller build successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Subordinate Controller build failed" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Subordinate Controller build error: $_" -ForegroundColor Red
}

# Clean up test images
Write-Host "`n=== Cleaning up test images ===" -ForegroundColor Yellow
docker rmi test-dashboard test-boss-controller test-subordinate-controller -f 2>$null

Write-Host "`nIndividual build tests completed!" -ForegroundColor Cyan
# Simple PowerShell runner
# Run this directly in PowerShell: .\run.ps1

Write-Host "===== WSL2 + Docker Engine Setup =====" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script needs to run as Administrator." -ForegroundColor Yellow
    Write-Host "Restarting with elevated privileges..." -ForegroundColor Yellow
    Start-Process PowerShell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSScriptRoot\run.ps1`"" -Verb RunAs
    exit
}

# Already admin, run directly
& "$PSScriptRoot\setup-all.ps1"
# Manually set WSL distribution for start.ps1

param(
    [string]$DistroName
)

if (-not $DistroName) {
    Write-Host "Usage: .\set-wsl-distro.ps1 -DistroName <name>" -ForegroundColor Yellow
    Write-Host "Example: .\set-wsl-distro.ps1 -DistroName 'Ubuntu-22.04'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Available distributions:" -ForegroundColor Cyan
    wsl --list --verbose
    exit
}

# Test if the distribution works
Write-Host "Testing distribution '$DistroName'..." -ForegroundColor Yellow
$test = wsl -d $DistroName echo "test" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Distribution '$DistroName' is not available or not working" -ForegroundColor Red
    Write-Host "Available distributions:" -ForegroundColor Yellow
    wsl --list --verbose
    exit 1
}

Write-Host "Distribution '$DistroName' is working!" -ForegroundColor Green

# Update start.ps1
$startScript = Get-Content "start.ps1" -Raw

# Replace the WSL distribution detection logic
$newLogic = @"
# Get default WSL distribution
`$wslDistro = "$DistroName"
"@

$updatedScript = $startScript -replace '# Get default WSL distribution.*?}', $newLogic, 'Singleline'

Set-Content "start.ps1" $updatedScript -Encoding UTF8

Write-Host "Updated start.ps1 to use distribution: $DistroName" -ForegroundColor Green
Write-Host "You can now run .\start.ps1" -ForegroundColor Cyan
# Debug WSL Distribution Issues

Write-Host "=== WSL Debug Information ===" -ForegroundColor Green

Write-Host "`n1. WSL Status:" -ForegroundColor Cyan
wsl --status

Write-Host "`n2. WSL List (raw output):" -ForegroundColor Cyan
$rawList = wsl --list
Write-Host "Raw bytes: $($rawList | ForEach-Object { [System.Text.Encoding]::Unicode.GetBytes($_) })"
$rawList

Write-Host "`n3. WSL List --verbose:" -ForegroundColor Cyan
wsl --list --verbose

Write-Host "`n4. WSL List --quiet:" -ForegroundColor Cyan
$quietList = wsl --list --quiet
$quietList | ForEach-Object { Write-Host "  [$_] (Length: $($_.Length))" }

Write-Host "`n5. Testing direct distribution names:" -ForegroundColor Cyan
$testNames = @("Ubuntu", "Ubuntu-22.04", "Ubuntu-20.04", "Debian", "docker-desktop", "docker-desktop-data")

foreach ($name in $testNames) {
    Write-Host -NoNewline "Testing $name... "
    $result = wsl -d $name echo "OK" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Works" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed (Exit code: $LASTEXITCODE)" -ForegroundColor Red
    }
}

Write-Host "`n6. Current start.ps1 configuration:" -ForegroundColor Cyan
$startContent = Get-Content "start.ps1" | Select-String "wslDistro"
$startContent | ForEach-Object { Write-Host "  $_" }

Write-Host "`nPress any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
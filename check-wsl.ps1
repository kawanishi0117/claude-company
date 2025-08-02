# WSL Distribution Check Script
Write-Host "Checking WSL distributions..." -ForegroundColor Yellow

# Method 1: List all distributions
Write-Host "`nMethod 1: wsl --list --quiet" -ForegroundColor Cyan
$distros1 = wsl --list --quiet 2>$null
if ($distros1) {
    Write-Host "Found distributions:" -ForegroundColor Green
    $distros1 | ForEach-Object { 
        if ($_ -ne "") {
            Write-Host "  - [$_]" -ForegroundColor White
        }
    }
} else {
    Write-Host "No distributions found" -ForegroundColor Red
}

# Method 2: List all distributions with verbose
Write-Host "`nMethod 2: wsl --list --verbose" -ForegroundColor Cyan
wsl --list --verbose

# Method 3: Get default distribution
Write-Host "`nMethod 3: Default distribution" -ForegroundColor Cyan
$defaultDistro = wsl --list --quiet | Where-Object { $_ -match '\*' -or $_ -match '既定' -or $_ -match 'default' }
if ($defaultDistro) {
    Write-Host "Default: $defaultDistro" -ForegroundColor Green
}

# Method 4: Try common distribution names
Write-Host "`nMethod 4: Testing common distribution names" -ForegroundColor Cyan
$commonDistros = @("Ubuntu", "Ubuntu-22.04", "Ubuntu-20.04", "Ubuntu-18.04", "Debian", "kali-linux", "openSUSE-42", "SLES-12")
foreach ($distro in $commonDistros) {
    $test = wsl -d $distro echo "OK" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $distro is available" -ForegroundColor Green
    }
}

Write-Host "`nPress any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
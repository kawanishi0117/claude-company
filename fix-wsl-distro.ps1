# WSL Distribution Detection Fix

Write-Host "=== WSL Distribution Detection Fix ===" -ForegroundColor Green

# Get all available WSL distributions
Write-Host "Detecting WSL distributions..." -ForegroundColor Yellow
$wslDistros = @()

try {
    # Method 1: Parse wsl --list output more carefully
    $rawOutput = wsl --list 2>$null
    if ($rawOutput) {
        # Remove BOM and clean up the output
        $cleanOutput = $rawOutput | ForEach-Object { 
            $_ -replace '\x00', '' -replace '\*', '' -replace '既定', '' -replace '\(Default\)', '' -replace '\(既定\)', ''
        } | Where-Object { $_ -match '\S' }
        
        foreach ($line in $cleanOutput) {
            $trimmed = $line.Trim()
            if ($trimmed -and $trimmed -notmatch '^Windows Subsystem' -and $trimmed -ne '') {
                $wslDistros += $trimmed
            }
        }
    }
    
    # Method 2: Try common distribution names
    $commonNames = @("Ubuntu", "Ubuntu-22.04", "Ubuntu-20.04", "Ubuntu-18.04", "Debian", "kali-linux")
    foreach ($name in $commonNames) {
        $test = wsl -d $name echo "test" 2>$null
        if ($LASTEXITCODE -eq 0 -and $wslDistros -notcontains $name) {
            $wslDistros += $name
        }
    }
    
    if ($wslDistros.Count -eq 0) {
        Write-Host "No WSL distributions found!" -ForegroundColor Red
        Write-Host "Please install a WSL distribution first:" -ForegroundColor Yellow
        Write-Host "  wsl --install -d Ubuntu" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host "Found WSL distributions:" -ForegroundColor Green
    for ($i = 0; $i -lt $wslDistros.Count; $i++) {
        Write-Host "  [$($i+1)] $($wslDistros[$i])" -ForegroundColor White
    }
    
    # Select distribution
    if ($wslDistros.Count -eq 1) {
        $selectedDistro = $wslDistros[0]
        Write-Host "Using: $selectedDistro" -ForegroundColor Green
    } else {
        Write-Host "Please select a distribution (1-$($wslDistros.Count)):" -ForegroundColor Yellow
        $selection = Read-Host
        $index = [int]$selection - 1
        if ($index -ge 0 -and $index -lt $wslDistros.Count) {
            $selectedDistro = $wslDistros[$index]
        } else {
            $selectedDistro = $wslDistros[0]
        }
        Write-Host "Using: $selectedDistro" -ForegroundColor Green
    }
    
    # Update start.ps1 with the correct distribution name
    $startScript = Get-Content "start.ps1" -Raw
    $updatedScript = $startScript -replace '\$wslDistro = "Ubuntu"', "`$wslDistro = `"$selectedDistro`""
    $updatedScript = $updatedScript -replace 'wsl --list --quiet \| Where-Object \{ \$_ -ne "" \} \| Select-Object -First 1', "echo `"$selectedDistro`""
    
    Set-Content "start.ps1" $updatedScript -Encoding UTF8
    
    Write-Host "Updated start.ps1 with distribution: $selectedDistro" -ForegroundColor Green
    Write-Host "You can now run .\start.ps1" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error detecting WSL distributions: $_" -ForegroundColor Red
    Write-Host "Please run this command to check WSL status:" -ForegroundColor Yellow
    Write-Host "  wsl --list --verbose" -ForegroundColor Cyan
}
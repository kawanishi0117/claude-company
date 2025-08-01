# Claude Company System - Status Monitor Script
# Real-time system monitoring and health dashboard

param(
    [switch]$Continuous,
    [int]$RefreshInterval = 5,
    [switch]$Detailed,
    [switch]$Json
)

function Get-SystemStatus {
    $status = @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        containers = @()
        services = @()
        resources = @{}
        health = @{
            overall = "unknown"
            issues = @()
        }
    }

    # Get container information
    try {
        $containers = docker-compose ps --format "json" 2>$null | ConvertFrom-Json
        foreach ($container in $containers) {
            $containerInfo = @{
                name = $container.Name
                service = $container.Service
                state = $container.State
                status = $container.Status
                ports = $container.Publishers -split ", "
            }
            
            # Get resource usage
            try {
                $stats = docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}" $container.Name 2>$null
                if ($stats) {
                    $parts = $stats -split ","
                    $containerInfo.cpu = $parts[0] -replace '%', ''
                    $containerInfo.memory = $parts[1]
                    $containerInfo.network = $parts[2]
                    $containerInfo.disk = $parts[3]
                }
            } catch {
                $containerInfo.cpu = "N/A"
                $containerInfo.memory = "N/A"
            }
            
            $status.containers += $containerInfo
        }
    } catch {
        $status.health.issues += "Failed to get container information"
    }

    # Check service endpoints
    $endpoints = @{
        "Dashboard" = @{ url = "http://localhost:3000"; critical = $true }
        "API" = @{ url = "http://localhost:8000/health"; critical = $true }
        "Elasticsearch" = @{ url = "http://localhost:9200"; critical = $false }
        "Kibana" = @{ url = "http://localhost:5601"; critical = $false }
    }

    foreach ($service in $endpoints.GetEnumerator()) {
        $serviceInfo = @{
            name = $service.Key
            url = $service.Value.url
            status = "unknown"
            responseTime = $null
            critical = $service.Value.critical
        }

        try {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $response = Invoke-WebRequest -Uri $service.Value.url -TimeoutSec 5 -UseBasicParsing
            $stopwatch.Stop()
            
            $serviceInfo.status = if ($response.StatusCode -eq 200) { "healthy" } else { "unhealthy" }
            $serviceInfo.responseTime = $stopwatch.ElapsedMilliseconds
        } catch {
            $serviceInfo.status = "unreachable"
            $serviceInfo.error = $_.Exception.Message
            if ($service.Value.critical) {
                $status.health.issues += "$($service.Key) is unreachable"
            }
        }

        $status.services += $serviceInfo
    }

    # Check Redis connectivity
    try {
        $redisTest = docker exec $(docker-compose ps -q redis) redis-cli ping 2>$null
        $redisStatus = if ($redisTest -eq "PONG") { "healthy" } else { "unhealthy" }
    } catch {
        $redisStatus = "unreachable"
        $status.health.issues += "Redis is unreachable"
    }
    
    $status.services += @{
        name = "Redis"
        status = $redisStatus
        critical = $true
    }

    # Calculate overall health
    $criticalServices = $status.services | Where-Object { $_.critical }
    $healthyCritical = ($criticalServices | Where-Object { $_.status -eq "healthy" }).Count
    $totalCritical = $criticalServices.Count

    if ($healthyCritical -eq $totalCritical) {
        $status.health.overall = "healthy"
    } elseif ($healthyCritical -gt ($totalCritical / 2)) {
        $status.health.overall = "degraded"
    } else {
        $status.health.overall = "unhealthy"
    }

    # Get system resources
    try {
        $dockerStats = docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}" 2>$null
        $status.resources.docker = $dockerStats
        
        # Get host system info
        $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
        $memory = Get-WmiObject -Class Win32_OperatingSystem
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
        
        $status.resources.host = @{
            cpu = [math]::Round($cpu.Average, 1)
            memory = @{
                used = [math]::Round(($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / 1MB, 1)
                total = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 1)
                percent = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 1)
            }
            disk = @{
                free = [math]::Round($disk.FreeSpace / 1GB, 1)
                total = [math]::Round($disk.Size / 1GB, 1)
                percent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)
            }
        }
    } catch {
        $status.health.issues += "Failed to get system resource information"
    }

    return $status
}

function Show-Status {
    param($Status)

    if ($Json) {
        $Status | ConvertTo-Json -Depth 10
        return
    }

    Clear-Host
    
    # Header
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║              Claude Company System Status Monitor            ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Last Updated: $($Status.timestamp)" -ForegroundColor Gray
    Write-Host ""

    # Overall Health
    $healthColor = switch ($Status.health.overall) {
        "healthy" { "Green" }
        "degraded" { "Yellow" }
        "unhealthy" { "Red" }
        default { "Gray" }
    }
    
    Write-Host "🎯 Overall System Health: " -NoNewline
    Write-Host $Status.health.overall.ToUpper() -ForegroundColor $healthColor
    
    if ($Status.health.issues.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Issues Detected:" -ForegroundColor Yellow
        foreach ($issue in $Status.health.issues) {
            Write-Host "   • $issue" -ForegroundColor Red
        }
    }
    Write-Host ""

    # Services Status
    Write-Host "🌐 Service Endpoints:" -ForegroundColor Cyan
    Write-Host "┌──────────────────┬──────────────┬─────────────┬──────────────┐" -ForegroundColor Gray
    Write-Host "│ Service          │ Status       │ Response    │ URL          │" -ForegroundColor Gray
    Write-Host "├──────────────────┼──────────────┼─────────────┼──────────────┤" -ForegroundColor Gray
    
    foreach ($service in $Status.services) {
        $statusColor = switch ($service.status) {
            "healthy" { "Green" }
            "unhealthy" { "Yellow" }
            "unreachable" { "Red" }
            default { "Gray" }
        }
        
        $serviceName = $service.name.PadRight(16)
        $serviceStatus = $service.status.PadRight(12)
        $responseTime = if ($service.responseTime) { "$($service.responseTime)ms".PadRight(11) } else { "N/A".PadRight(11) }
        $url = if ($service.url) { $service.url } else { "N/A" }
        
        Write-Host "│ $serviceName │ " -NoNewline -ForegroundColor Gray
        Write-Host $serviceStatus -NoNewline -ForegroundColor $statusColor
        Write-Host " │ $responseTime │ $url" -ForegroundColor Gray
    }
    Write-Host "└──────────────────┴──────────────┴─────────────┴──────────────┘" -ForegroundColor Gray
    Write-Host ""

    # Container Status
    Write-Host "🐳 Docker Containers:" -ForegroundColor Cyan
    if ($Status.containers.Count -eq 0) {
        Write-Host "   No containers running" -ForegroundColor Red
    } else {
        Write-Host "┌─────────────────────────────┬──────────────┬──────────────┬─────────────┐" -ForegroundColor Gray
        Write-Host "│ Container                   │ State        │ CPU          │ Memory      │" -ForegroundColor Gray
        Write-Host "├─────────────────────────────┼──────────────┼──────────────┼─────────────┤" -ForegroundColor Gray
        
        foreach ($container in $Status.containers) {
            $stateColor = switch ($container.state) {
                "running" { "Green" }
                "exited" { "Red" }
                "restarting" { "Yellow" }
                default { "Gray" }
            }
            
            $name = $container.name.PadRight(27)
            $state = $container.state.PadRight(12)
            $cpu = if ($container.cpu -ne "N/A") { "$($container.cpu)%".PadRight(12) } else { "N/A".PadRight(12) }
            $memory = if ($container.memory -ne "N/A") { $container.memory.PadRight(11) } else { "N/A".PadRight(11) }
            
            Write-Host "│ $name │ " -NoNewline -ForegroundColor Gray
            Write-Host $state -NoNewline -ForegroundColor $stateColor
            Write-Host " │ $cpu │ $memory │" -ForegroundColor Gray
        }
        Write-Host "└─────────────────────────────┴──────────────┴──────────────┴─────────────┘" -ForegroundColor Gray
    }
    Write-Host ""

    # System Resources
    if ($Status.resources.host) {
        Write-Host "💾 Host System Resources:" -ForegroundColor Cyan
        $host = $Status.resources.host
        
        Write-Host "   CPU Usage:    $($host.cpu)%" -ForegroundColor $(if ($host.cpu -gt 80) { "Red" } elseif ($host.cpu -gt 60) { "Yellow" } else { "Green" })
        Write-Host "   Memory:       $($host.memory.used)GB / $($host.memory.total)GB ($($host.memory.percent)%)" -ForegroundColor $(if ($host.memory.percent -gt 80) { "Red" } elseif ($host.memory.percent -gt 60) { "Yellow" } else { "Green" })
        Write-Host "   Disk Space:   $($host.disk.free)GB free / $($host.disk.total)GB total ($($host.disk.percent)% used)" -ForegroundColor $(if ($host.disk.percent -gt 90) { "Red" } elseif ($host.disk.percent -gt 80) { "Yellow" } else { "Green" })
        Write-Host ""
    }

    # Quick Actions
    Write-Host "🔧 Quick Actions:" -ForegroundColor Cyan
    Write-Host "   [L] View logs    [R] Restart services    [S] Scale subordinates    [Q] Quit" -ForegroundColor White
    
    if ($Continuous) {
        Write-Host ""
        Write-Host "Refreshing in $RefreshInterval seconds... (Press 'Q' to quit)" -ForegroundColor Gray
    }
}

function Show-QuickActions {
    if (-not $Continuous) {
        return
    }
    
    $key = $null
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true).Key
    }
    
    switch ($key) {
        'L' {
            Clear-Host
            Write-Host "Recent system logs (press Ctrl+C to return):" -ForegroundColor Cyan
            docker-compose logs --tail 50 -f
        }
        'R' {
            Write-Host "Restarting services..." -ForegroundColor Yellow
            docker-compose restart
            Write-Host "Services restarted" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        'S' {
            Write-Host "Current subordinate count:" -ForegroundColor Yellow
            $current = (docker-compose ps subordinate-controller -q).Count
            Write-Host "Currently running: $current subordinates" -ForegroundColor White
            $new = Read-Host "Enter new count (or press Enter to cancel)"
            if ($new -and $new -match '^\d+$') {
                Write-Host "Scaling to $new subordinates..." -ForegroundColor Yellow
                docker-compose up -d --scale subordinate-controller=$new
                Write-Host "Scaled successfully" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
        }
        'Q' {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 0
        }
    }
}

# Main execution
try {
    if ($Continuous) {
        Write-Host "Starting continuous monitoring (refresh every $RefreshInterval seconds)..." -ForegroundColor Green
        Write-Host "Press 'Q' to quit, 'L' for logs, 'R' to restart, 'S' to scale" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        
        while ($true) {
            $status = Get-SystemStatus
            Show-Status -Status $status
            
            Show-QuickActions
            
            Start-Sleep -Seconds $RefreshInterval
        }
    } else {
        $status = Get-SystemStatus
        Show-Status -Status $status
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
# Claude Company System - Troubleshooting Guide

Comprehensive troubleshooting guide for common issues and their resolutions.

## Table of Contents
1. [System Diagnostics](#system-diagnostics)
2. [Startup Issues](#startup-issues)
3. [Runtime Issues](#runtime-issues)
4. [Performance Issues](#performance-issues)
5. [Network Issues](#network-issues)
6. [API and Authentication](#api-and-authentication)
7. [Docker Issues](#docker-issues)
8. [Log Analysis](#log-analysis)
9. [Recovery Procedures](#recovery-procedures)

## System Diagnostics

### Quick Health Check
Run the system status monitor to get an overview:
```powershell
.\status.ps1
```

### Detailed System Information
```powershell
# Comprehensive status with resource usage
.\status.ps1 -Detailed

# Continuous monitoring
.\status.ps1 -Continuous

# JSON output for automation
.\status.ps1 -Json
```

### Manual Health Checks
```powershell
# Check Docker status
docker info
docker-compose ps

# Check service endpoints
curl http://localhost:3000  # Dashboard
curl http://localhost:8000/health  # API
curl http://localhost:9200  # Elasticsearch
curl http://localhost:5601  # Kibana

# Check Redis
docker-compose exec redis redis-cli ping
```

## Startup Issues

### Issue: Docker Desktop Not Starting
**Error**: "Docker daemon is not running"

**Diagnosis**:
```powershell
# Check Docker service status
Get-Service com.docker.service
```

**Solutions**:
1. **Restart Docker Desktop**:
   ```powershell
   # Close Docker Desktop
   Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
   
   # Start Docker Desktop
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   ```

2. **Restart Docker Service**:
   ```powershell
   Restart-Service com.docker.service
   ```

3. **Reset Docker to Factory Defaults**:
   - Open Docker Desktop
   - Settings → Troubleshoot → Reset to factory defaults

4. **Check Windows Features**:
   ```powershell
   # Enable required Windows features
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
   ```

### Issue: Environment Configuration Errors
**Error**: "Invalid ANTHROPIC_API_KEY"

**Diagnosis**:
```powershell
# Check .env file contents
Get-Content .env | Select-String "ANTHROPIC_API_KEY"
```

**Solutions**:
1. **Verify API Key Format**:
   - Must start with `sk-ant-`
   - Should be 64+ characters long
   - No extra spaces or quotes

2. **Test API Key**:
   ```powershell
   $apiKey = "your-api-key-here"
   $headers = @{
       "x-api-key" = $apiKey
       "Content-Type" = "application/json"
   }
   $body = @{
       model = "claude-3-5-sonnet-20241022"
       max_tokens = 10
       messages = @(@{
           role = "user"
           content = "Hello"
       })
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" -Method POST -Headers $headers -Body $body
   ```

### Issue: Port Conflicts
**Error**: "Port 3000 is already in use"

**Diagnosis**:
```powershell
# Find what's using the port
netstat -ano | findstr :3000
Get-Process -Id <PID>
```

**Solutions**:
1. **Stop Conflicting Service**:
   ```powershell
   Stop-Process -Id <PID>
   ```

2. **Change Ports**:
   Edit `docker-compose.yml`:
   ```yaml
   services:
     dashboard:
       ports:
         - "3001:3000"
   ```

3. **Use Port Mapping Script**:
   ```powershell
   # Check available ports
   $ports = 3000..3010
   foreach ($port in $ports) {
       $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
       if (-not $conn.TcpTestSucceeded) {
           Write-Host "Port $port is available"
           break
       }
   }
   ```

### Issue: Insufficient System Resources
**Error**: "Not enough memory" or containers being killed

**Diagnosis**:
```powershell
# Check system resources
Get-WmiObject -Class Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
docker system df
docker stats --no-stream
```

**Solutions**:
1. **Increase Docker Memory**:
   - Docker Desktop → Settings → Resources → Memory
   - Allocate at least 4GB, preferably 8GB+

2. **Reduce Elasticsearch Memory**:
   ```env
   ES_JAVA_OPTS=-Xms256m -Xmx256m
   ```

3. **Reduce Subordinate Replicas**:
   ```env
   SUBORDINATE_REPLICAS=1
   ```

## Runtime Issues

### Issue: AI Agents Not Responding
**Symptoms**: Agents show as idle, tasks not being processed

**Diagnosis**:
```powershell
# Check agent container logs
docker-compose logs boss-controller
docker-compose logs subordinate-controller

# Check task queue
docker-compose exec redis redis-cli LLEN task_queue
```

**Solutions**:
1. **Restart Agent Services**:
   ```powershell
   docker-compose restart boss-controller subordinate-controller
   ```

2. **Check Claude API Connectivity**:
   ```powershell
   # Test from inside container
   docker-compose exec boss-controller curl -I https://api.anthropic.com
   ```

3. **Verify Environment Variables**:
   ```powershell
   docker-compose exec boss-controller env | grep ANTHROPIC
   ```

### Issue: WebSocket Connection Failures
**Symptoms**: Dashboard shows "Disconnected from server"

**Diagnosis**:
```powershell
# Check WebSocket endpoint
curl -H "Upgrade: websocket" http://localhost:8000/ws

# Check dashboard logs
docker-compose logs dashboard
```

**Solutions**:
1. **Restart Dashboard Service**:
   ```powershell
   docker-compose restart dashboard
   ```

2. **Check Proxy Settings**:
   - Disable corporate proxy for localhost
   - Add localhost to proxy bypass list

3. **Browser Issues**:
   - Clear browser cache
   - Disable browser extensions
   - Try incognito mode

### Issue: Database Connection Errors
**Symptoms**: "Redis connection failed"

**Diagnosis**:
```powershell
# Test Redis connectivity
docker-compose exec redis redis-cli ping
docker-compose exec boss-controller redis-cli -h redis ping
```

**Solutions**:
1. **Restart Redis**:
   ```powershell
   docker-compose restart redis
   ```

2. **Check Redis Configuration**:
   ```powershell
   docker-compose exec redis redis-cli CONFIG GET "*"
   ```

3. **Network Connectivity**:
   ```powershell
   # Test network connectivity between containers
   docker-compose exec boss-controller ping redis
   ```

## Performance Issues

### Issue: Slow Response Times
**Symptoms**: Long delays in task processing, UI lag

**Diagnosis**:
```powershell
# Check resource usage
docker stats --no-stream

# Check API response times
Measure-Command { curl http://localhost:8000/health }

# Check system performance
Get-Counter "\Processor(_Total)\% Processor Time"
```

**Solutions**:
1. **Scale Resources**:
   ```powershell
   # Increase subordinate replicas
   docker-compose up -d --scale subordinate-controller=5
   ```

2. **Optimize Memory**:
   ```env
   # Increase Elasticsearch memory
   ES_JAVA_OPTS=-Xms1g -Xmx1g
   ```

3. **Database Optimization**:
   ```powershell
   # Clear Redis if needed
   docker-compose exec redis redis-cli FLUSHDB
   ```

### Issue: High CPU Usage
**Symptoms**: System becomes unresponsive, fans spinning

**Diagnosis**:
```powershell
# Check which containers are using CPU
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check host CPU usage
Get-Process | Sort CPU -Descending | Select -First 10
```

**Solutions**:
1. **Limit Container Resources**:
   ```yaml
   services:
     subordinate-controller:
       deploy:
         resources:
           limits:
             cpus: "0.5"
   ```

2. **Reduce Concurrent Tasks**:
   ```env
   SUBORDINATE_REPLICAS=2
   ```

## Network Issues

### Issue: External API Calls Failing
**Symptoms**: "Connection timeout" to api.anthropic.com

**Diagnosis**:
```powershell
# Test connectivity from host
curl -I https://api.anthropic.com

# Test from container
docker-compose exec boss-controller curl -I https://api.anthropic.com

# Check DNS resolution
nslookup api.anthropic.com
```

**Solutions**:
1. **Check Firewall**:
   ```powershell
   # Temporarily disable Windows Firewall for testing
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   ```

2. **Corporate Proxy**:
   ```yaml
   services:
     boss-controller:
       environment:
         - HTTP_PROXY=http://proxy.company.com:8080
         - HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **DNS Issues**:
   ```yaml
   services:
     boss-controller:
       dns:
         - 8.8.8.8
         - 1.1.1.1
   ```

### Issue: Inter-Container Communication
**Symptoms**: Services can't reach each other

**Diagnosis**:
```powershell
# Check Docker networks
docker network ls
docker network inspect claude-company-system_default

# Test connectivity
docker-compose exec boss-controller ping redis
docker-compose exec dashboard ping boss-controller
```

**Solutions**:
1. **Recreate Network**:
   ```powershell
   docker-compose down
   docker network prune -f
   docker-compose up -d
   ```

2. **Check Service Names**:
   Ensure services use correct hostnames as defined in docker-compose.yml

## API and Authentication

### Issue: Authentication Failures
**Symptoms**: 401 Unauthorized responses

**Diagnosis**:
```powershell
# Check API key in logs (masked)
docker-compose logs boss-controller | Select-String "auth"

# Verify API key format
$env:ANTHROPIC_API_KEY -match "^sk-ant-"
```

**Solutions**:
1. **Regenerate API Key**:
   - Visit https://console.anthropic.com/
   - Create new API key
   - Update .env file

2. **Check Account Status**:
   - Verify account has sufficient credits
   - Check API usage limits

### Issue: Rate Limiting
**Symptoms**: "Rate limit exceeded" errors

**Diagnosis**:
```powershell
# Check rate limit headers in logs
docker-compose logs boss-controller | Select-String "rate.limit"
```

**Solutions**:
1. **Implement Backoff**:
   ```env
   # Reduce concurrent requests
   SUBORDINATE_REPLICAS=1
   ```

2. **Upgrade Plan**:
   - Consider higher tier plan for increased limits

## Docker Issues

### Issue: Container Build Failures
**Symptoms**: "Build failed" during startup

**Diagnosis**:
```powershell
# Build with verbose output
docker-compose build --no-cache --progress=plain
```

**Solutions**:
1. **Clear Build Cache**:
   ```powershell
   docker builder prune -f
   docker-compose build --no-cache
   ```

2. **Check Dockerfile Syntax**:
   - Verify Dockerfile syntax
   - Check base image availability

### Issue: Volume Mount Issues
**Symptoms**: Files not persisting, permission errors

**Diagnosis**:
```powershell
# Check volume mounts
docker-compose config | Select-String -A5 -B5 "volumes"

# Check file permissions
docker-compose exec boss-controller ls -la /workspace
```

**Solutions**:
1. **Reset Volumes**:
   ```powershell
   docker-compose down -v
   docker volume prune -f
   docker-compose up -d
   ```

2. **Fix Permissions**:
   ```powershell
   # From container
   docker-compose exec boss-controller chown -R node:node /workspace
   ```

## Log Analysis

### Centralized Logging
Access logs through multiple methods:

```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f boss-controller

# Filtered logs
docker-compose logs | Select-String "ERROR"

# Export logs
docker-compose logs > system-logs.txt
```

### Kibana Dashboard
Access Kibana at http://localhost:5601 for:
- Real-time log streaming
- Advanced filtering and search
- Log analytics and visualization

### Common Log Patterns
Look for these patterns in logs:

**Successful Operations**:
```
✓ Task completed successfully
✓ WebSocket connection established
✓ Health check passed
```

**Warnings**:
```
⚠ High memory usage detected
⚠ API rate limit approaching
⚠ Connection retry attempt
```

**Errors**:
```
✗ API authentication failed
✗ Database connection lost
✗ Container health check failed
```

## Recovery Procedures

### Full System Reset
When all else fails:

```powershell
# Complete system reset
docker-compose down -v
docker system prune -af
docker volume prune -f

# Remove all containers and images
docker container prune -f
docker image prune -af

# Restart from scratch
.\start-enhanced.ps1 --no-cache
```

### Data Recovery
```powershell
# Backup current state
docker-compose exec redis redis-cli BGSAVE

# Export data
mkdir backup
docker-compose exec elasticsearch curl -X GET "localhost:9200/_all/_search" > backup/elasticsearch-data.json

# Restore from backup
docker-compose exec redis redis-cli FLUSHDB
docker-compose exec redis redis-cli < backup/redis-backup.rdb
```

### Configuration Reset
```powershell
# Reset to default configuration
Copy-Item .env.example .env
Copy-Item config/claude-config-template.json config/claude-config.json

# Edit with your values
notepad .env
notepad config/claude-config.json
```

## Emergency Contacts

### System Status
- **Health Dashboard**: http://localhost:3000
- **API Status**: http://localhost:8000/health
- **Monitoring**: `.\status.ps1 -Continuous`

### Support Resources
- **Documentation**: docs/ folder
- **GitHub Issues**: Project repository issues page
- **Community Forum**: [Link to community forum]
- **Enterprise Support**: [Enterprise support contact]

---

**Note**: Always backup your data before performing recovery procedures. When reporting issues, include relevant logs and system information from the diagnostics section.
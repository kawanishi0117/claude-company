# Claude Company System - Setup Guide

## 言語選択 / Language Selection

- [English](SETUP.md) ← Current page
- [日本語](SETUP.ja.md)

---

Complete setup instructions for deploying the Claude Company System on Windows.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [First Launch](#first-launch)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **Windows 10/11** (64-bit)
- **Docker Desktop** (latest version)
  - Download: https://www.docker.com/products/docker-desktop
  - Minimum 4GB RAM allocated to Docker
- **PowerShell 5.1+** (included with Windows)
- **Git** (for source code management)
  - Download: https://git-scm.com/download/win

### Required Services
- **Anthropic Claude API** (requires $100+ plan)
  - Sign up: https://console.anthropic.com/
  - Generate API key with appropriate permissions
- **Internet Connection** (for downloading Docker images and API calls)

### Optional but Recommended
- **Visual Studio Code** (for configuration editing)
- **Windows Terminal** (for better PowerShell experience)

## System Requirements

### Minimum Requirements
- **CPU**: 4 cores, 2.5+ GHz
- **RAM**: 8GB (4GB for Docker, 4GB for system)
- **Storage**: 20GB free space
- **Network**: Broadband internet (for API calls)

### Recommended Requirements
- **CPU**: 8+ cores, 3.0+ GHz
- **RAM**: 16GB+ (8GB for Docker, 8GB for system)
- **Storage**: 50GB+ SSD storage
- **Network**: High-speed internet with low latency

### Docker Resources
Configure Docker Desktop with these minimum resources:
- **Memory**: 4GB
- **CPU**: 4 cores
- **Disk**: 20GB

## Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/claude-company-system.git
cd claude-company-system
```

### Step 2: Verify Docker Installation
```powershell
# Check Docker is running
docker --version
docker-compose --version

# Test Docker functionality
docker run hello-world
```

### Step 3: Download Required Images (Optional)
```powershell
# Pre-download images to speed up first launch
docker-compose pull
```

## Configuration

### Step 1: Environment Configuration
1. Copy the example environment file:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` file with your settings:
   ```env
   # Required: Your Claude API key
   ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   
   # System Configuration
   SUBORDINATE_REPLICAS=3        # Number of AI workers
   LOG_LEVEL=info               # debug, info, warn, error
   NODE_ENV=production          # production or development
   
   # Security
   REDIS_PASSWORD=your-secure-password-here
   
   # Performance Tuning
   ES_JAVA_OPTS=-Xms512m -Xmx512m  # Elasticsearch memory
   ```

### Step 2: Claude Code CLI Configuration
1. Copy the configuration template:
   ```powershell
   Copy-Item config/claude-config-template.json config/claude-config.json
   ```

2. Customize the configuration for your environment:
   - Adjust model settings and timeouts
   - Configure workspace paths
   - Set up integrations

### Step 3: Resource Allocation
Based on your system specs, adjust resource allocation in `docker-compose.yml`:

For 8GB RAM systems:
```yaml
services:
  elasticsearch:
    environment:
      - "ES_JAVA_OPTS=-Xms256m -Xmx256m"
```

For 16GB+ RAM systems:
```yaml
services:
  elasticsearch:
    environment:
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
```

## First Launch

### Option 1: Enhanced Script (Recommended)
Use the enhanced startup script with full health checking:

```powershell
# Basic startup
.\start-enhanced.ps1

# Development mode with debug logging
.\start-enhanced.ps1 -Development

# Custom number of AI workers
.\start-enhanced.ps1 -Replicas 5

# Skip health checks for faster startup
.\start-enhanced.ps1 -SkipHealthCheck
```

### Option 2: Basic Script
For simpler startup without advanced features:

```powershell
.\start.ps1
```

### Option 3: Manual Docker Compose
For advanced users who want full control:

```powershell
# Start core services first
docker-compose up -d redis elasticsearch

# Wait for core services to initialize
Start-Sleep -Seconds 30

# Start application services
docker-compose up -d --scale subordinate-controller=3
```

## Verification

### System Health Check
After startup, verify the system is running correctly:

```powershell
# Run the status monitor
.\status.ps1

# Or check individual services
docker-compose ps
docker-compose logs -f --tail 100
```

### Access Points
Once running, access these endpoints:

- **Main Dashboard**: http://localhost:3000
- **API Endpoint**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Kibana (Logs)**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

### Test AI Functionality
1. Open the dashboard at http://localhost:3000
2. Navigate to the instruction submission form
3. Submit a simple test instruction: "Create a simple 'Hello World' JavaScript function"
4. Monitor the agents panel for activity
5. Check logs for successful processing

## Troubleshooting

### Common Issues

#### Docker Not Starting
**Symptoms**: "Docker daemon is not running" error
**Solutions**:
1. Start Docker Desktop manually
2. Restart Docker Desktop service:
   ```powershell
   Restart-Service com.docker.service
   ```
3. Reset Docker Desktop to factory defaults
4. Check Windows virtualization is enabled (Hyper-V/WSL2)

#### API Key Issues
**Symptoms**: Authentication errors, 401 responses
**Solutions**:
1. Verify API key format starts with `sk-ant-`
2. Check API key has sufficient credits
3. Ensure API key has proper permissions
4. Test API key with curl:
   ```powershell
   curl -X POST https://api.anthropic.com/v1/messages `
     -H "x-api-key: your-api-key" `
     -H "Content-Type: application/json" `
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hello"}]}'
   ```

#### Port Conflicts
**Symptoms**: "Port already in use" errors
**Solutions**:
1. Check what's using the ports:
   ```powershell
   netstat -ano | findstr :3000
   netstat -ano | findstr :8000
   ```
2. Stop conflicting services or change ports in docker-compose.yml
3. Use different ports:
   ```yaml
   ports:
     - "3001:3000"  # Dashboard on port 3001
     - "8001:8000"  # API on port 8001
   ```

#### Memory Issues
**Symptoms**: Containers being killed, out of memory errors
**Solutions**:
1. Increase Docker Desktop memory allocation
2. Reduce Elasticsearch memory in .env:
   ```env
   ES_JAVA_OPTS=-Xms256m -Xmx256m
   ```
3. Reduce number of subordinate replicas:
   ```env
   SUBORDINATE_REPLICAS=1
   ```

#### Network Connectivity
**Symptoms**: Services can't communicate, API timeouts
**Solutions**:
1. Check Windows firewall settings
2. Verify Docker network configuration:
   ```powershell
   docker network ls
   docker network inspect claude-company-system_default
   ```
3. Restart Docker networking:
   ```powershell
   docker-compose down
   docker system prune -f
   docker-compose up -d
   ```

### Performance Optimization

#### For Development
```env
NODE_ENV=development
LOG_LEVEL=debug
SUBORDINATE_REPLICAS=1
ES_JAVA_OPTS=-Xms256m -Xmx256m
```

#### For Production
```env
NODE_ENV=production
LOG_LEVEL=info
SUBORDINATE_REPLICAS=5
ES_JAVA_OPTS=-Xms1g -Xmx1g
```

### Log Analysis
Check different log sources for issues:

```powershell
# System logs
.\status.ps1 -Detailed

# Container logs
docker-compose logs boss-controller
docker-compose logs subordinate-controller
docker-compose logs dashboard

# Application logs
docker-compose exec boss-controller cat logs/app.log
```

### Getting Help

1. **Check Documentation**: Review README.md and docs/ folder
2. **System Status**: Run `.\status.ps1` for real-time diagnostics
3. **Logs**: Examine logs with `docker-compose logs -f`
4. **Health Endpoints**: Check http://localhost:8000/health
5. **Community Support**: Report issues to the project repository

### Advanced Configuration

#### Custom Docker Compose
For production deployments, create a custom `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  boss-controller:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
  
  elasticsearch:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    environment:
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
```

#### Environment-Specific Configs
Maintain separate environment files:
- `.env.development`
- `.env.staging`  
- `.env.production`

Copy the appropriate one to `.env` before startup.

## Next Steps

After successful setup:
1. Review the [User Guide](USER_GUIDE.md) for usage instructions
2. Check [API Documentation](API.md) for integration details
3. Explore [Advanced Configuration](ADVANCED.md) for customization
4. Set up [Monitoring](MONITORING.md) for production deployments

---

For additional support, consult the troubleshooting section or reach out to the development team.
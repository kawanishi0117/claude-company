# Environment Configuration Guide

## .env File Configuration

The `.env` file now supports additional configuration options for Windows WSL users:

### WSL Configuration

```bash
# WSL Configuration (Windows only)
# Set this if you want to specify a particular WSL distribution
WSL_DISTRIBUTION=Ubuntu

# Docker Mode Configuration  
# Set to 'wsl' to force WSL Docker, 'windows' to force Windows Docker
# Leave empty for auto-detection
DOCKER_MODE=wsl
```

### Usage

1. **Automatic Detection**: Leave `WSL_DISTRIBUTION` empty and the system will try to auto-detect
2. **Manual Override**: Set `WSL_DISTRIBUTION=Ubuntu` (or your specific distribution name)
3. **Force Docker Mode**: 
   - `DOCKER_MODE=wsl` - Forces WSL Docker usage
   - `DOCKER_MODE=windows` - Forces Windows Docker Desktop usage
   - Leave empty for automatic detection

### Troubleshooting

If you encounter WSL distribution errors:

1. Check available distributions:
   ```powershell
   wsl --list --verbose
   ```

2. Set the correct distribution name in `.env`:
   ```bash
   WSL_DISTRIBUTION=YourDistributionName
   ```

3. Or force Windows Docker mode:
   ```bash
   DOCKER_MODE=windows
   ```

The system will now read these settings from `.env` and use them during startup.
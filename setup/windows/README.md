# WSL2 + Docker Engine Setup for Windows

This directory contains a one-command setup script to automatically install WSL2 and Docker Engine on Windows without Docker Desktop.

## Requirements

- Windows 10 version 2004 or higher (Build 19041 or higher)
- Windows 11
- Administrator privileges

## Usage

Simply run:
```
setup-all.bat
```

## What it does

1. **Checks existing installation** - If WSL2 and Docker are already installed, skips to verification
2. **Enables Windows features** - WSL and Virtual Machine Platform
3. **Installs WSL2** - Sets as default version and updates to latest
4. **Installs Ubuntu 22.04** - Default Linux distribution
5. **Installs Docker Engine** - Inside WSL2 environment
6. **Configures Docker** - Enables systemd and auto-start
7. **Verifies installation** - Automatically tests all components

## After Installation

The script automatically:
- Restarts WSL
- Starts Docker service
- Runs hello-world test
- Shows installation status

You can then use Docker by entering WSL:
```
wsl
docker run hello-world
```

## Features

- **Smart detection** - Automatically detects if components are already installed
- **One command** - Everything runs with a single `setup-all.bat` command
- **Auto verification** - Tests all components after installation
- **No Docker Desktop** - Uses native Docker Engine in WSL2

## Notes

- First run may require a system restart after enabling Windows features
- The script will prompt you to restart and continue after reboot
- Ubuntu installation will prompt for username/password on first use
- All Docker commands should be run inside WSL, not Windows CMD/PowerShell
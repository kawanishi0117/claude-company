# Claude Company System

A hierarchical AI development system that automates project development through AI collaboration. The system operates on Windows Docker environments where a Boss AI manages multiple Subordinate AIs to execute development tasks.

## Quick Start

### Prerequisites

- Windows 10/11 with Docker Desktop
- Claude API Key (requires $100 plan)
- 8GB+ RAM recommended
- 4+ CPU cores recommended

### Installation

1. Clone this repository
2. Copy `.env.example` to `.env` and set your `ANTHROPIC_API_KEY`
3. Run the startup script:

**PowerShell:**
```powershell
.\start.ps1
```

**Command Prompt:**
```cmd
start.bat
```

### Access Points

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:8000
- **Kibana (Logs)**: http://localhost:5601
- **Redis**: localhost:6379

## Architecture

The system consists of:

- **Boss AI Container**: Manages tasks, reviews code, runs integration tests
- **Subordinate AI Containers**: Execute development tasks and unit tests
- **Web Dashboard**: React-based monitoring interface
- **Task Queue**: Redis-based task distribution
- **Log Aggregation**: Elasticsearch + Kibana for monitoring

## Usage

1. Access the dashboard at http://localhost:3000
2. Enter development instructions in the input field
3. Monitor AI agents' progress in real-time
4. View logs and performance metrics

## Development

### Project Structure

```
claude-company-system/
├── src/                    # Core application source
├── dashboard/              # React web dashboard
├── docker/                 # Docker configurations
├── logs/                   # Log files
├── tests/                  # Test files
├── docker-compose.yml      # Main Docker configuration
└── start.ps1/start.bat     # Startup scripts
```

### Commands

```bash
# View logs
docker-compose logs -f

# Stop system
docker-compose down

# Rebuild containers
docker-compose build --no-cache

# Scale subordinate AIs
docker-compose up -d --scale subordinate-controller=5
```

## Configuration

Environment variables in `.env`:

- `ANTHROPIC_API_KEY`: Claude API key (required)
- `SUBORDINATE_REPLICAS`: Number of subordinate AIs (default: 3)
- `LOG_LEVEL`: Logging level (default: info)

## Troubleshooting

### Common Issues

1. **Docker not running**: Start Docker Desktop
2. **API key invalid**: Check your Claude API key in `.env`
3. **Port conflicts**: Ensure ports 3000, 8000, 5601, 6379, 9200 are available
4. **Memory issues**: Increase Docker memory allocation to 8GB+

### Logs

View service-specific logs:
```bash
docker-compose logs -f boss-controller
docker-compose logs -f subordinate-controller
docker-compose logs -f dashboard
```

## License

MIT License - see LICENSE file for details
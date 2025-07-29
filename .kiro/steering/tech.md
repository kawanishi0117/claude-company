# Technology Stack

## Core Technologies

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript for type safety and better development experience
- **Containerization**: Docker Desktop for Windows with Docker Compose
- **AI Integration**: Claude Code CLI (requires $100 plan API key)

## Frontend Stack

- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI for consistent design
- **Real-time Communication**: Socket.io for WebSocket connections
- **Build Tool**: Standard React build tools

## Backend Stack

- **Queue System**: Redis + Bull Queue for task distribution
- **Process Management**: Node.js child processes for Claude CLI control
- **Version Control**: Git with automated branch management
- **Logging**: Elasticsearch + Kibana for log aggregation and visualization

## Development Tools

- **Code Quality**: ESLint + Prettier
- **Testing**: Unit tests required for all components
- **Commit Standards**: Conventional Commits format

## Common Commands

### Development Setup
```bash
npm install          # Install dependencies
npm run dev         # Start development mode
```

### Production Deployment
```bash
# Windows PowerShell
.\start.ps1

# Windows Command Prompt  
start.bat
```

### Docker Operations
```bash
docker-compose logs -f                    # View all logs
docker-compose logs -f boss-controller    # View specific service logs
docker exec -it boss-ai claude --version # Test Claude CLI
```

### Testing
```bash
npm test            # Run unit tests
npm run test:e2e    # Run end-to-end tests
```

## Environment Configuration

Required environment variables in `.env`:
- `ANTHROPIC_API_KEY`: Claude API key (required)
- `SUBORDINATE_REPLICAS`: Number of subordinate AIs (default: 3)
- `REDIS_URL`: Redis connection URL (default: redis://redis:6379)
- `LOG_LEVEL`: Logging level (default: info)

## Resource Requirements

- **Memory**: Minimum 8GB recommended
- **CPU**: Minimum 4 cores recommended
- **Storage**: Docker volumes for shared Git repository
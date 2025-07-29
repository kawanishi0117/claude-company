# Project Structure

## Directory Organization

```
claude-company-system/
├── src/                          # Core application source code
│   ├── controllers/              # Boss and Subordinate AI controllers
│   ├── queue/                    # Task queue system implementation
│   ├── claude/                   # Claude Code CLI integration
│   ├── git/                      # Git management utilities
│   ├── models/                   # TypeScript interfaces and data models
│   └── prompts/                  # AI prompt templates
├── dashboard/                    # React web dashboard
│   └── src/                      # Dashboard source code
├── docker/                       # Docker configuration files
│   ├── boss-ai/                  # Boss AI container setup
│   ├── subordinate-ai/           # Subordinate AI container setup
│   └── shared/                   # Shared container configurations
├── logs/                         # Log aggregation configuration
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── docs/                         # Documentation
├── .kiro/                        # Kiro AI assistant configuration
│   ├── steering/                 # AI assistant guidance rules
│   └── specs/                    # Project specifications
├── docker-compose.yml            # Main Docker Compose configuration
├── start.ps1                     # Windows PowerShell startup script
├── start.bat                     # Windows batch startup script
└── .env                          # Environment variables
```

## Key Architectural Patterns

### Container Architecture
- Each AI agent runs in isolated Docker containers
- Shared Git volume for collaboration
- Redis for inter-container communication
- Centralized logging with Elasticsearch

### Code Organization
- **Controllers**: Handle AI agent lifecycle and task coordination
- **Queue System**: Manages task distribution and status tracking
- **Claude Integration**: Abstracts Claude Code CLI interactions
- **Models**: TypeScript interfaces for type safety

### Data Flow Patterns
1. User input → Web Dashboard → Boss Controller
2. Task decomposition → Boss AI → Task Queue
3. Task execution → Subordinate AI → Work results
4. Code review → Boss AI → Final deliverables
5. Git operations → Automated version control

## Naming Conventions

- **Files**: kebab-case for filenames (`task-queue.ts`)
- **Classes**: PascalCase (`BossController`)
- **Functions**: camelCase (`processTask`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with 'I' prefix (`ITask`)

## Import/Export Standards

- Use explicit imports/exports
- Group imports: external libraries first, then internal modules
- Use TypeScript path mapping for clean imports

## Testing Structure

- Unit tests alongside source files (`*.test.ts`)
- Integration tests in dedicated directory
- End-to-end tests covering full workflows
- Mock Claude CLI interactions for testing

## Configuration Management

- Environment-specific configs in `.env` files
- Docker configurations in dedicated `docker/` directory
- Claude CLI configs as JSON templates
- Centralized logging configuration
# Claude Company System - Data Models

This directory contains the core data models and validation functions for the Claude Company System.

## Overview

The Claude Company System uses TypeScript interfaces to define data structures and validation functions to ensure data integrity throughout the system. All data models are strongly typed and include comprehensive validation.

## Core Data Models

### Task
Represents a work item that can be assigned to AI agents.

```typescript
interface Task {
  id: string;                    // Unique identifier
  title: string;                 // Human-readable title
  description: string;           // Detailed description
  priority: number;              // Priority level (0 = highest)
  dependencies: string[];        // Array of task IDs this task depends on
  assignedTo?: string;           // ID of assigned agent (optional)
  status: TaskStatus;            // Current status
  createdAt: Date;               // Creation timestamp
  deadline?: Date;               // Optional deadline
}
```

### Agent
Represents an AI agent (Boss or Subordinate) in the system.

```typescript
interface Agent {
  id: string;                           // Unique identifier
  type: AgentType;                      // BOSS | SUBORDINATE
  status: AgentStatus;                  // IDLE | WORKING | ERROR
  currentTask?: string;                 // Currently assigned task ID
  lastActivity: Date;                   // Last activity timestamp
  performanceMetrics: Record<string, any>; // Performance data
}
```

### Project
Represents a development project containing multiple tasks.

```typescript
interface Project {
  id: string;                    // Unique identifier
  name: string;                  // Project name
  description: string;           // Project description
  repositoryPath: string;        // Git repository path
  status: ProjectStatus;         // Current status
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
  tasks: Task[];                 // Array of project tasks
}
```

### WorkResult
Represents the output from an AI agent completing a task.

```typescript
interface WorkResult {
  taskId: string;                // ID of completed task
  agentId: string;               // ID of agent who completed the task
  codeChanges: CodeChange[];     // Array of code modifications
  testResults: TestResult;       // Test execution results
  completionTime: Date;          // When the task was completed
}
```

### TestResult
Represents the results of running tests (unit or integration).

```typescript
interface TestResult {
  testType: TestType;            // UNIT | INTEGRATION
  passed: boolean;               // Overall pass/fail status
  totalTests: number;            // Total number of tests
  passedTests: number;           // Number of passed tests
  failedTests: number;           // Number of failed tests
  executionTime: number;         // Execution time in milliseconds
  details: TestDetail[];         // Detailed test results
}
```

## Enums

### TaskStatus
- `PENDING` - Task is waiting to be started
- `IN_PROGRESS` - Task is currently being worked on
- `COMPLETED` - Task has been completed successfully
- `FAILED` - Task failed to complete
- `CANCELLED` - Task was cancelled

### AgentStatus
- `IDLE` - Agent is available for work
- `WORKING` - Agent is currently executing a task
- `ERROR` - Agent encountered an error

### AgentType
- `BOSS` - Boss AI that manages and coordinates work
- `SUBORDINATE` - Subordinate AI that executes specific tasks

### ProjectStatus
- `ACTIVE` - Project is currently active
- `COMPLETED` - Project has been completed
- `PAUSED` - Project is temporarily paused
- `CANCELLED` - Project was cancelled

## Validation Functions

All data models include corresponding validation functions that ensure data integrity:

```typescript
// Validate a task object
const task = validateTask(taskData);

// Validate an agent object
const agent = validateAgent(agentData);

// Validate a project object
const project = validateProject(projectData);

// Validate work results
const workResult = validateWorkResult(workResultData);
```

### Error Handling

Validation functions throw `ValidationError` when data is invalid:

```typescript
try {
  const task = validateTask(invalidTaskData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.message);
    console.log('Field:', error.field); // Which field caused the error
  }
}
```

## Usage Examples

### Creating a Task

```typescript
import { Task, TaskStatus, validateTask } from './models';

const newTask: Task = {
  id: 'task-001',
  title: 'Implement user authentication',
  description: 'Create login and registration functionality',
  priority: 1,
  dependencies: [],
  status: TaskStatus.PENDING,
  createdAt: new Date()
};

// Validate the task
const validatedTask = validateTask(newTask);
```

### Creating an Agent

```typescript
import { Agent, AgentType, AgentStatus, validateAgent } from './models';

const bossAgent: Agent = {
  id: 'boss-001',
  type: AgentType.BOSS,
  status: AgentStatus.IDLE,
  lastActivity: new Date(),
  performanceMetrics: {
    tasksAssigned: 0,
    tasksCompleted: 0
  }
};

const validatedAgent = validateAgent(bossAgent);
```

### Working with Projects

```typescript
import { Project, ProjectStatus, validateProject } from './models';

const project: Project = {
  id: 'proj-001',
  name: 'E-commerce Platform',
  description: 'Full-stack e-commerce solution',
  repositoryPath: '/workspace/ecommerce',
  status: ProjectStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  tasks: [] // Will be populated with tasks
};

const validatedProject = validateProject(project);
```

## Dashboard Models

Additional models are provided for the web dashboard:

- `AgentStatusCard` - UI representation of agent status
- `LogEntry` - System log entries
- `TimelineItem` - Timeline visualization data
- `ProgressDashboard` - Overall progress information

## Testing

All validation functions are thoroughly tested. Run tests with:

```bash
npm test
```

The test suite includes:
- Valid data validation
- Invalid data rejection
- Edge case handling
- Error message verification

## Files

- `types.ts` - TypeScript interface definitions and enums
- `validation.ts` - Validation functions and error handling
- `index.ts` - Main export file
- `examples.ts` - Usage examples and demonstrations
- `validation.test.ts` - Comprehensive test suite
- `README.md` - This documentation file

## Integration

These data models are used throughout the Claude Company System:

- **Controllers** - Use models for type safety and validation
- **Queue System** - Validates task and work result data
- **Dashboard** - Uses models for UI state management
- **Git Management** - Uses project and task models
- **Logging** - Uses log entry models for structured logging

The models ensure consistency and type safety across all system components while providing robust validation to prevent data corruption and runtime errors.
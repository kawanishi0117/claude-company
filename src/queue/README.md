# Task Queue System

The Task Queue System is a Redis-based queue implementation using Bull Queue for managing tasks in the Claude Company System. It provides reliable task distribution, processing, and result handling for AI agents.

## Features

- **Redis-based**: Uses Redis for persistent task storage and distribution
- **Bull Queue**: Leverages Bull Queue for robust job processing
- **Priority Support**: Tasks can be prioritized for execution order
- **Retry Logic**: Automatic retry with exponential backoff for failed tasks
- **Event-driven**: Emits events for task lifecycle management
- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Testing**: Complete unit test coverage

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Boss AI       │    │   Task Queue    │    │ Subordinate AI  │
│                 │    │                 │    │                 │
│ Creates Tasks   │───▶│  Redis + Bull   │◀───│ Processes Tasks │
│ Reviews Results │◀───│     Queue       │───▶│ Submits Results │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. RedisConnection
Manages Redis connection with singleton pattern:
- Connection pooling and health monitoring
- Automatic reconnection on failures
- Configuration management

### 2. TaskQueue
Main queue management class:
- Task addition and retrieval
- Priority-based task distribution
- Result processing and completion tracking
- Queue statistics and monitoring

### 3. Types and Interfaces
Comprehensive type definitions for:
- Task and job structures
- Queue configuration
- Event handling
- Statistics and monitoring

## Usage

### Basic Setup

```typescript
import { TaskQueue } from './queue';
import { Task, TaskStatus } from '../models/types';

// Initialize the queue
const taskQueue = new TaskQueue();
await taskQueue.initialize();

// Create a task
const task: Task = {
  id: 'task-001',
  title: 'Implement user authentication',
  description: 'Create login and registration functionality',
  priority: 10,
  dependencies: [],
  status: TaskStatus.PENDING,
  createdAt: new Date()
};

// Add task to queue
const jobId = await taskQueue.addTask(task);
console.log(`Task added with job ID: ${jobId}`);
```

### Agent Task Processing

```typescript
// Agent gets next available task
const task = await taskQueue.getNextTask('agent-001');

if (task) {
  console.log(`Processing task: ${task.title}`);
  
  // Process the task...
  
  // Submit work result
  const workResult = {
    taskId: task.id,
    agentId: 'agent-001',
    codeChanges: [/* ... */],
    testResults: {/* ... */},
    completionTime: new Date()
  };
  
  await taskQueue.completeTask(task.id, workResult);
}
```

### Event Handling

```typescript
// Listen for queue events
taskQueue.on('job:added', (job) => {
  console.log(`New job added: ${job.task.title}`);
});

taskQueue.on('job:completed', (job, result) => {
  console.log(`Job completed: ${job.task.title}`);
});

taskQueue.on('job:failed', (job, error) => {
  console.error(`Job failed: ${job.task.title}`, error);
});

taskQueue.on('queue:error', (error) => {
  console.error('Queue error:', error);
});
```

### Queue Statistics

```typescript
// Get queue statistics
const stats = await taskQueue.getStats();
console.log(`Waiting: ${stats.waiting}, Active: ${stats.active}`);

// Get all tasks with status
const allTasks = await taskQueue.getAllTasks();
allTasks.forEach(({ task, status }) => {
  console.log(`${task.title}: ${status}`);
});
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Queue Configuration
QUEUE_CONCURRENCY=3
```

### Custom Configuration

```typescript
import { QueueConfig } from './queue/types';

const customConfig: QueueConfig = {
  redis: {
    host: 'redis-server',
    port: 6379,
    password: 'secure-password',
    db: 1
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
};
```

## Task Priorities

Tasks are automatically prioritized based on their priority value:

- **Critical (20)**: Priority >= 10
- **High (10)**: Priority >= 5
- **Normal (5)**: Priority >= 2
- **Low (1)**: Priority < 2

## Error Handling

The queue system includes comprehensive error handling:

### Retry Logic
- Failed tasks are automatically retried up to 3 times
- Exponential backoff delay between retries
- Dead letter queue for permanently failed tasks

### Connection Resilience
- Automatic Redis reconnection
- Health checks and monitoring
- Graceful degradation on connection loss

### Validation
- All tasks and work results are validated before processing
- Type-safe interfaces prevent runtime errors
- Comprehensive error messages for debugging

## Testing

Run the queue system tests:

```bash
# Run all queue tests
npm test src/queue

# Run specific test file
npm test src/queue/task-queue.test.ts

# Run with coverage
npm test src/queue --coverage
```

## Example

See `src/queue/example.ts` for a complete demonstration of the queue system functionality.

```bash
# Run the example
npx ts-node src/queue/example.ts
```

## Monitoring and Maintenance

### Queue Cleanup
```typescript
// Clean up old completed/failed jobs (older than 24 hours)
await taskQueue.cleanup(24 * 60 * 60 * 1000);
```

### Health Checks
```typescript
// Check Redis connection
const isConnected = redisConnection.isConnected();
const canPing = await redisConnection.ping();

// Get Redis server info
const serverInfo = await redisConnection.getInfo();
```

### Graceful Shutdown
```typescript
// Close queue connections
await taskQueue.close();
await redisConnection.disconnect();
```

## Integration with AI Agents

The queue system is designed to integrate seamlessly with the Boss AI and Subordinate AI controllers:

1. **Boss AI** creates and prioritizes tasks
2. **Task Queue** distributes tasks to available agents
3. **Subordinate AIs** process tasks and submit results
4. **Boss AI** reviews results and manages integration

This creates a scalable, fault-tolerant system for distributed AI development work.
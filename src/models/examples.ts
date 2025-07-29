/**
 * Example usage of the Claude Company System data models
 */

import {
  Task,
  Agent,
  Project,
  WorkResult,
  TestResult,
  CodeChange,
  LogEntry,
  AgentStatusCard,
  AgentType,
  AgentStatus,
  TaskStatus,
  ProjectStatus,
  TestType,
  LogLevel,
  validateTask,
  validateAgent,
  validateProject,
  validateWorkResult,
  ValidationError
} from './index';

// Example: Creating and validating a Task
export const createExampleTask = (): Task => {
  const task: Task = {
    id: 'task-001',
    title: 'Implement user authentication',
    description: 'Create login and registration functionality with JWT tokens',
    priority: 1,
    dependencies: ['task-000'], // Depends on project setup
    assignedTo: 'subordinate-ai-001',
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
  };

  try {
    return validateTask(task);
  } catch (error) {
    console.error('Task validation failed:', error);
    throw error;
  }
};

// Example: Creating and validating an Agent
export const createExampleBossAgent = (): Agent => {
  const agent: Agent = {
    id: 'boss-ai-001',
    type: AgentType.BOSS,
    status: AgentStatus.WORKING,
    currentTask: 'task-001',
    lastActivity: new Date(),
    performanceMetrics: {
      tasksAssigned: 15,
      tasksCompleted: 12,
      averageTaskCompletionTime: 3600000, // 1 hour in milliseconds
      successRate: 80
    }
  };

  try {
    return validateAgent(agent);
  } catch (error) {
    console.error('Agent validation failed:', error);
    throw error;
  }
};

// Example: Creating and validating a Project
export const createExampleProject = (): Project => {
  const project: Project = {
    id: 'project-001',
    name: 'E-commerce Platform',
    description: 'A full-stack e-commerce platform with React frontend and Node.js backend',
    repositoryPath: '/workspace/shared-git/ecommerce-platform',
    status: ProjectStatus.ACTIVE,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    updatedAt: new Date(),
    tasks: [createExampleTask()]
  };

  try {
    return validateProject(project);
  } catch (error) {
    console.error('Project validation failed:', error);
    throw error;
  }
};

// Example: Creating and validating a WorkResult
export const createExampleWorkResult = (): WorkResult => {
  const codeChanges: CodeChange[] = [
    {
      filePath: '/src/auth/login.ts',
      action: 'CREATE',
      content: `
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const login = async (email: string, password: string) => {
  // Login implementation
  const user = await findUserByEmail(email);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    throw new Error('Invalid credentials');
  }
  
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
  return { token, user };
};
      `.trim(),
      diff: '+import jwt from \'jsonwebtoken\';\n+import bcrypt from \'bcrypt\';\n...'
    },
    {
      filePath: '/src/auth/register.ts',
      action: 'CREATE',
      content: `
import bcrypt from 'bcrypt';

export const register = async (email: string, password: string) => {
  // Registration implementation
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists');
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, passwordHash });
  return user;
};
      `.trim()
    }
  ];

  const testResults: TestResult = {
    testType: TestType.UNIT,
    passed: true,
    totalTests: 8,
    passedTests: 8,
    failedTests: 0,
    executionTime: 2500, // 2.5 seconds
    details: [
      {
        name: 'should login with valid credentials',
        passed: true,
        duration: 150
      },
      {
        name: 'should reject invalid credentials',
        passed: true,
        duration: 120
      },
      {
        name: 'should register new user',
        passed: true,
        duration: 200
      },
      {
        name: 'should reject duplicate email',
        passed: true,
        duration: 100
      }
    ]
  };

  const workResult: WorkResult = {
    taskId: 'task-001',
    agentId: 'subordinate-ai-001',
    codeChanges,
    testResults,
    completionTime: new Date()
  };

  try {
    return validateWorkResult(workResult);
  } catch (error) {
    console.error('WorkResult validation failed:', error);
    throw error;
  }
};

// Example: Creating and validating a LogEntry
export const createExampleLogEntry = (): LogEntry => {
  const logEntry: LogEntry = {
    id: 'log-001',
    timestamp: new Date(),
    level: LogLevel.INFO,
    agentId: 'subordinate-ai-001',
    message: 'Task "Implement user authentication" completed successfully',
    metadata: {
      taskId: 'task-001',
      executionTime: 3600000,
      linesOfCode: 150,
      testsCreated: 8
    }
  };

  return logEntry;
};

// Example: Creating and validating an AgentStatusCard
export const createExampleAgentStatusCard = (): AgentStatusCard => {
  const statusCard: AgentStatusCard = {
    agentId: 'subordinate-ai-001',
    agentType: 'subordinate',
    status: 'working',
    currentTask: 'Implement user authentication',
    progress: 75,
    executionTime: 2700000, // 45 minutes
    lastActivity: new Date(),
    performanceMetrics: {
      tasksCompleted: 5,
      averageExecutionTime: 3200000, // ~53 minutes
      successRate: 100
    }
  };

  return statusCard;
};

// Example: Error handling with validation
export const demonstrateValidationError = (): void => {
  try {
    // This will fail validation
    const invalidTask = {
      id: '', // Invalid: empty string
      title: 'Test Task',
      description: 'A test task',
      priority: -1, // Invalid: negative priority
      dependencies: 'not-an-array', // Invalid: should be array
      status: 'INVALID_STATUS', // Invalid: not a valid TaskStatus
      createdAt: 'not-a-date' // Invalid: should be Date object
    };

    validateTask(invalidTask);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('Validation Error:', error.message);
      console.log('Field:', error.field);
    } else {
      console.log('Unexpected error:', error);
    }
  }
};

// Example: Using the models in a typical workflow
export const demonstrateWorkflow = (): void => {
  console.log('=== Claude Company System Data Models Demo ===\n');

  try {
    // 1. Create a project
    const project = createExampleProject();
    console.log('✅ Project created:', project.name);

    // 2. Create agents
    const bossAgent = createExampleBossAgent();
    console.log('✅ Boss Agent created:', bossAgent.id);

    // 3. Create a task
    const task = createExampleTask();
    console.log('✅ Task created:', task.title);

    // 4. Create work result
    const workResult = createExampleWorkResult();
    console.log('✅ Work Result created for task:', workResult.taskId);
    console.log('   - Code changes:', workResult.codeChanges.length);
    console.log('   - Tests passed:', workResult.testResults.passedTests);

    // 5. Create log entry
    const logEntry = createExampleLogEntry();
    console.log('✅ Log Entry created:', logEntry.message);

    // 6. Create status card
    const statusCard = createExampleAgentStatusCard();
    console.log('✅ Agent Status Card created for:', statusCard.agentId);
    console.log('   - Progress:', statusCard.progress + '%');

    console.log('\n🎉 All data models validated successfully!');

  } catch (error) {
    console.error('❌ Error in workflow:', error);
  }

  // Demonstrate error handling
  console.log('\n=== Validation Error Demo ===');
  demonstrateValidationError();
};

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateWorkflow();
}
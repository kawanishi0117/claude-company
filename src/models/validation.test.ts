/**
 * Unit tests for data validation functions
 */

import {
  validateTask,
  validateAgent,
  validateProject,
  validateWorkResult,
  validateTestResult,
  validateCodeChange,
  validateLogEntry,
  validateAgentStatusCard,
  ValidationError
} from './validation';

import {
  AgentType,
  AgentStatus,
  TaskStatus,
  ProjectStatus,
  TestType,
  LogLevel
} from './types';

describe('Data Validation Tests', () => {
  describe('validateTask', () => {
    const validTask = {
      id: 'task-123',
      title: 'Test Task',
      description: 'A test task description',
      priority: 1,
      dependencies: ['dep-1', 'dep-2'],
      assignedTo: 'agent-1',
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000) // 1 day from now
    };

    it('should validate a valid task', () => {
      expect(() => validateTask(validTask)).not.toThrow();
      const result = validateTask(validTask);
      expect(result).toEqual(validTask);
    });

    it('should throw error for invalid task object', () => {
      expect(() => validateTask(null)).toThrow(ValidationError);
      expect(() => validateTask('not an object')).toThrow(ValidationError);
    });

    it('should throw error for missing required fields', () => {
      const invalidTask = { ...validTask };
      delete (invalidTask as any).id;
      expect(() => validateTask(invalidTask)).toThrow('Task ID must be a non-empty string');
    });

    it('should throw error for invalid priority', () => {
      const invalidTask = { ...validTask, priority: -1 };
      expect(() => validateTask(invalidTask)).toThrow('Task priority must be a non-negative number');
    });

    it('should throw error for invalid dependencies', () => {
      const invalidTask = { ...validTask, dependencies: 'not an array' };
      expect(() => validateTask(invalidTask)).toThrow('Task dependencies must be an array');
    });

    it('should throw error for invalid status', () => {
      const invalidTask = { ...validTask, status: 'INVALID_STATUS' };
      expect(() => validateTask(invalidTask)).toThrow('Task status must be a valid TaskStatus');
    });

    it('should allow optional fields to be undefined', () => {
      const taskWithoutOptionals = {
        id: 'task-123',
        title: 'Test Task',
        description: 'A test task description',
        priority: 1,
        dependencies: [],
        status: TaskStatus.PENDING,
        createdAt: new Date()
      };
      expect(() => validateTask(taskWithoutOptionals)).not.toThrow();
    });
  });

  describe('validateAgent', () => {
    const validAgent = {
      id: 'agent-123',
      type: AgentType.BOSS,
      status: AgentStatus.IDLE,
      currentTask: 'task-1',
      lastActivity: new Date(),
      performanceMetrics: {
        tasksCompleted: 10,
        averageExecutionTime: 5000
      }
    };

    it('should validate a valid agent', () => {
      expect(() => validateAgent(validAgent)).not.toThrow();
      const result = validateAgent(validAgent);
      expect(result).toEqual(validAgent);
    });

    it('should throw error for invalid agent type', () => {
      const invalidAgent = { ...validAgent, type: 'INVALID_TYPE' };
      expect(() => validateAgent(invalidAgent)).toThrow('Agent type must be a valid AgentType');
    });

    it('should throw error for invalid agent status', () => {
      const invalidAgent = { ...validAgent, status: 'INVALID_STATUS' };
      expect(() => validateAgent(invalidAgent)).toThrow('Agent status must be a valid AgentStatus');
    });

    it('should throw error for invalid lastActivity', () => {
      const invalidAgent = { ...validAgent, lastActivity: 'not a date' };
      expect(() => validateAgent(invalidAgent)).toThrow('Agent lastActivity must be a valid Date');
    });

    it('should allow currentTask to be undefined', () => {
      const agentWithoutCurrentTask = { ...validAgent };
      delete (agentWithoutCurrentTask as any).currentTask;
      expect(() => validateAgent(agentWithoutCurrentTask)).not.toThrow();
    });
  });

  describe('validateProject', () => {
    const validProject = {
      id: 'project-123',
      name: 'Test Project',
      description: 'A test project',
      repositoryPath: '/path/to/repo',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: []
    };

    it('should validate a valid project', () => {
      expect(() => validateProject(validProject)).not.toThrow();
      const result = validateProject(validProject);
      expect(result).toEqual(validProject);
    });

    it('should throw error for invalid project status', () => {
      const invalidProject = { ...validProject, status: 'INVALID_STATUS' };
      expect(() => validateProject(invalidProject)).toThrow('Project status must be a valid ProjectStatus');
    });

    it('should validate project with tasks', () => {
      const projectWithTasks = {
        ...validProject,
        tasks: [{
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          priority: 1,
          dependencies: [],
          status: TaskStatus.PENDING,
          createdAt: new Date()
        }]
      };
      expect(() => validateProject(projectWithTasks)).not.toThrow();
    });

    it('should throw error for invalid task in project', () => {
      const projectWithInvalidTask = {
        ...validProject,
        tasks: [{
          id: '', // Invalid empty ID
          title: 'Task 1',
          description: 'First task',
          priority: 1,
          dependencies: [],
          status: TaskStatus.PENDING,
          createdAt: new Date()
        }]
      };
      expect(() => validateProject(projectWithInvalidTask)).toThrow('Invalid task at index 0');
    });
  });

  describe('validateCodeChange', () => {
    const validCodeChange = {
      filePath: '/path/to/file.ts',
      action: 'CREATE' as const,
      content: 'console.log("Hello World");',
      diff: '+console.log("Hello World");'
    };

    it('should validate a valid code change', () => {
      expect(() => validateCodeChange(validCodeChange)).not.toThrow();
      const result = validateCodeChange(validCodeChange);
      expect(result).toEqual(validCodeChange);
    });

    it('should throw error for invalid action', () => {
      const invalidCodeChange = { ...validCodeChange, action: 'INVALID_ACTION' };
      expect(() => validateCodeChange(invalidCodeChange)).toThrow('CodeChange action must be CREATE, UPDATE, or DELETE');
    });

    it('should allow optional fields to be undefined', () => {
      const codeChangeWithoutOptionals = {
        filePath: '/path/to/file.ts',
        action: 'DELETE' as const
      };
      expect(() => validateCodeChange(codeChangeWithoutOptionals)).not.toThrow();
    });
  });

  describe('validateTestResult', () => {
    const validTestResult = {
      testType: TestType.UNIT,
      passed: true,
      totalTests: 10,
      passedTests: 8,
      failedTests: 2,
      executionTime: 5000,
      details: [
        {
          name: 'test 1',
          passed: true,
          duration: 100
        },
        {
          name: 'test 2',
          passed: false,
          error: 'Assertion failed',
          duration: 200
        }
      ]
    };

    it('should validate a valid test result', () => {
      expect(() => validateTestResult(validTestResult)).not.toThrow();
      const result = validateTestResult(validTestResult);
      expect(result).toEqual(validTestResult);
    });

    it('should throw error for invalid test type', () => {
      const invalidTestResult = { ...validTestResult, testType: 'INVALID_TYPE' };
      expect(() => validateTestResult(invalidTestResult)).toThrow('TestResult testType must be a valid TestType');
    });

    it('should throw error for negative numbers', () => {
      const invalidTestResult = { ...validTestResult, totalTests: -1 };
      expect(() => validateTestResult(invalidTestResult)).toThrow('TestResult totalTests must be a non-negative number');
    });

    it('should throw error for invalid test details', () => {
      const invalidTestResult = {
        ...validTestResult,
        details: [
          {
            name: '', // Invalid empty name
            passed: true,
            duration: 100
          }
        ]
      };
      expect(() => validateTestResult(invalidTestResult)).toThrow('TestDetail name at index 0 must be a non-empty string');
    });
  });

  describe('validateWorkResult', () => {
    const validWorkResult = {
      taskId: 'task-123',
      agentId: 'agent-456',
      codeChanges: [
        {
          filePath: '/path/to/file.ts',
          action: 'CREATE' as const,
          content: 'console.log("Hello");'
        }
      ],
      testResults: {
        testType: TestType.UNIT,
        passed: true,
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        executionTime: 2000,
        details: []
      },
      completionTime: new Date()
    };

    it('should validate a valid work result', () => {
      expect(() => validateWorkResult(validWorkResult)).not.toThrow();
      const result = validateWorkResult(validWorkResult);
      expect(result).toEqual(validWorkResult);
    });

    it('should throw error for invalid code changes', () => {
      const invalidWorkResult = {
        ...validWorkResult,
        codeChanges: [
          {
            filePath: '', // Invalid empty path
            action: 'CREATE' as const
          }
        ]
      };
      expect(() => validateWorkResult(invalidWorkResult)).toThrow('Invalid codeChange at index 0');
    });

    it('should throw error for invalid test results', () => {
      const invalidWorkResult = {
        ...validWorkResult,
        testResults: {
          ...validWorkResult.testResults,
          testType: 'INVALID_TYPE'
        }
      };
      expect(() => validateWorkResult(invalidWorkResult)).toThrow('Invalid testResults');
    });
  });

  describe('validateLogEntry', () => {
    const validLogEntry = {
      id: 'log-123',
      timestamp: new Date(),
      level: LogLevel.INFO,
      agentId: 'agent-456',
      message: 'Task completed successfully',
      metadata: {
        taskId: 'task-123',
        duration: 5000
      }
    };

    it('should validate a valid log entry', () => {
      expect(() => validateLogEntry(validLogEntry)).not.toThrow();
      const result = validateLogEntry(validLogEntry);
      expect(result).toEqual(validLogEntry);
    });

    it('should throw error for invalid log level', () => {
      const invalidLogEntry = { ...validLogEntry, level: 'INVALID_LEVEL' };
      expect(() => validateLogEntry(invalidLogEntry)).toThrow('LogEntry level must be a valid LogLevel');
    });

    it('should allow metadata to be undefined', () => {
      const logEntryWithoutMetadata = { ...validLogEntry };
      delete (logEntryWithoutMetadata as any).metadata;
      expect(() => validateLogEntry(logEntryWithoutMetadata)).not.toThrow();
    });
  });

  describe('validateAgentStatusCard', () => {
    const validAgentStatusCard = {
      agentId: 'agent-123',
      agentType: 'boss' as const,
      status: 'working' as const,
      currentTask: 'task-456',
      progress: 75,
      executionTime: 3000,
      lastActivity: new Date(),
      performanceMetrics: {
        tasksCompleted: 10,
        averageExecutionTime: 2500,
        successRate: 95
      }
    };

    it('should validate a valid agent status card', () => {
      expect(() => validateAgentStatusCard(validAgentStatusCard)).not.toThrow();
      const result = validateAgentStatusCard(validAgentStatusCard);
      expect(result).toEqual(validAgentStatusCard);
    });

    it('should throw error for invalid agent type', () => {
      const invalidCard = { ...validAgentStatusCard, agentType: 'invalid' };
      expect(() => validateAgentStatusCard(invalidCard)).toThrow('AgentStatusCard agentType must be boss or subordinate');
    });

    it('should throw error for invalid status', () => {
      const invalidCard = { ...validAgentStatusCard, status: 'invalid' };
      expect(() => validateAgentStatusCard(invalidCard)).toThrow('AgentStatusCard status must be idle, working, or error');
    });

    it('should throw error for invalid progress range', () => {
      const invalidCard = { ...validAgentStatusCard, progress: 150 };
      expect(() => validateAgentStatusCard(invalidCard)).toThrow('AgentStatusCard progress must be a number between 0 and 100');
    });

    it('should throw error for invalid performance metrics', () => {
      const invalidCard = {
        ...validAgentStatusCard,
        performanceMetrics: {
          ...validAgentStatusCard.performanceMetrics,
          successRate: 150 // Invalid range
        }
      };
      expect(() => validateAgentStatusCard(invalidCard)).toThrow('AgentStatusCard performanceMetrics.successRate must be a number between 0 and 100');
    });
  });
});
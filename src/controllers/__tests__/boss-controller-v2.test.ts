/**
 * BossControllerV2 Unit Tests
 * ClaudeCommandExecutorを使用する新しいBoss Controllerのテスト
 */

import { BossControllerV2, UserInstruction, BossControllerConfig } from '../boss-controller-v2';
import { ClaudeCommandExecutor } from '../../claude/command-executor';
import { TaskQueue } from '../../queue/task-queue';
import { Task, TaskStatus, WorkResult, TestType } from '../../models/types';

// ClaudeCommandExecutorのモック
jest.mock('../../claude/command-executor');
const MockedClaudeCommandExecutor = ClaudeCommandExecutor as jest.MockedClass<typeof ClaudeCommandExecutor>;

// TaskQueueのモック
jest.mock('../../queue/task-queue');
const MockedTaskQueue = TaskQueue as jest.MockedClass<typeof TaskQueue>;

describe('BossControllerV2', () => {
  let controller: BossControllerV2;
  let mockExecutor: jest.Mocked<ClaudeCommandExecutor>;
  let mockTaskQueue: jest.Mocked<TaskQueue>;

  const testConfig: BossControllerConfig = {
    workspacePath: '/test/workspace',
    taskTimeout: 5000,
    reviewTimeout: 3000,
    integrationTestTimeout: 10000
  };

  beforeEach(() => {
    // ClaudeCommandExecutorのモックを設定
    mockExecutor = {
      checkAvailability: jest.fn(),
      createMcpConfig: jest.fn(),
      setupWorkspace: jest.fn(),
      sendPromptExpectJSON: jest.fn(),
      sendPrompt: jest.fn(),
      cleanup: jest.fn(),
      on: jest.fn(),
      getStats: jest.fn(() => ({ totalCommands: 0, successfulCommands: 0, failedCommands: 0 }))
    } as any;

    MockedClaudeCommandExecutor.mockImplementation(() => mockExecutor);

    // TaskQueueのモックを設定
    mockTaskQueue = {
      initialize: jest.fn(),
      addTask: jest.fn(),
      getStats: jest.fn(() => ({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 })),
      close: jest.fn(),
      on: jest.fn()
    } as any;

    MockedTaskQueue.mockImplementation(() => mockTaskQueue);

    controller = new BossControllerV2(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid configuration', async () => {
      // モックの設定
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.createMcpConfig.mockResolvedValue('/test/workspace/.mcp-config.json');
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });

      await expect(controller.initialize()).resolves.not.toThrow();

      expect(mockExecutor.checkAvailability).toHaveBeenCalled();
      expect(mockExecutor.setupWorkspace).toHaveBeenCalledWith('/test/workspace');
      expect(mockTaskQueue.initialize).toHaveBeenCalled();
    });

    it('should handle Claude CLI unavailable error', async () => {
      mockExecutor.checkAvailability.mockResolvedValue(false);

      await expect(controller.initialize()).rejects.toThrow('Claude Code CLI is not available');
    });

    it('should not initialize twice', async () => {
      // 初回初期化
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });

      await controller.initialize();

      // 2回目の初期化（何もしない）
      jest.clearAllMocks();
      await controller.initialize();

      expect(mockExecutor.checkAvailability).not.toHaveBeenCalled();
      expect(mockTaskQueue.initialize).not.toHaveBeenCalled();
    });
  });

  describe('processUserInstruction', () => {
    beforeEach(async () => {
      // 初期化を完了
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
      await controller.initialize();
    });

    it('should process user instruction and decompose into tasks', async () => {
      const instruction: UserInstruction = {
        id: 'test-instruction-001',
        content: 'Create a calculator application with add and subtract functions',
        priority: 8,
        timestamp: new Date(),
        userId: 'user-001'
      };

      const mockResponse = {
        tasks: [
          {
            title: 'Create calculator class',
            description: 'Implement basic calculator class structure',
            priority: 8,
            estimatedDuration: 60,
            dependencies: [],
            requiredSkills: ['TypeScript'],
            acceptanceCriteria: ['Class should be created', 'Basic structure should be implemented']
          },
          {
            title: 'Implement add function',
            description: 'Add addition functionality to calculator',
            priority: 7,
            estimatedDuration: 30,
            dependencies: ['Create calculator class'],
            requiredSkills: ['TypeScript'],
            acceptanceCriteria: ['Add function should work correctly']
          }
        ],
        dependencies: {
          'Implement add function': ['Create calculator class']
        },
        estimatedDuration: 90,
        complexity: 'medium' as const
      };

      mockExecutor.sendPromptExpectJSON.mockResolvedValue(mockResponse);

      const result = await controller.processUserInstruction(instruction);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]?.title).toBe('Create calculator class');
      expect(result.tasks[1]?.title).toBe('Implement add function');
      expect(result.complexity).toBe('medium');
      expect(result.estimatedDuration).toBe(90);

      expect(mockExecutor.sendPromptExpectJSON).toHaveBeenCalledWith(
        expect.stringContaining('Create a calculator application with add and subtract functions'),
        expect.objectContaining({
          timeout: 5000,
          appendSystemPrompt: expect.stringContaining('experienced project manager')
        })
      );
    });

    it('should handle invalid instruction processing', async () => {
      const instruction: UserInstruction = {
        id: 'invalid-001',
        content: '',
        priority: 1,
        timestamp: new Date()
      };

      mockExecutor.sendPromptExpectJSON.mockRejectedValue(new Error('Invalid instruction'));

      await expect(controller.processUserInstruction(instruction)).rejects.toThrow('Invalid instruction');
    });
  });

  describe('reviewSubordinateWork', () => {
    beforeEach(async () => {
      // 初期化を完了
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
      await controller.initialize();
    });

    it('should review subordinate work successfully', async () => {
      const workResult: WorkResult = {
        taskId: 'task-001',
        agentId: 'subordinate-001',
        codeChanges: [
          {
            filePath: 'src/calculator.ts',
            action: 'CREATE',
            content: 'export class Calculator { add(a: number, b: number) { return a + b; } }'
          }
        ],
        testResults: {
          testType: TestType.UNIT,
          passed: true,
          totalTests: 5,
          passedTests: 5,
          failedTests: 0,
          executionTime: 1200,
          details: []
        },
        completionTime: new Date()
      };

      const mockReviewResponse = {
        approved: true,
        feedback: 'Good implementation with proper TypeScript typing',
        suggestions: ['Consider adding error handling'],
        issues: [],
        score: 85,
        codeQuality: {
          readability: 90,
          maintainability: 85,
          testCoverage: 80,
          performance: 90
        },
        recommendations: ['Add JSDoc comments']
      };

      mockExecutor.sendPromptExpectJSON.mockResolvedValue(mockReviewResponse);

      const result = await controller.reviewSubordinateWork(workResult);

      expect(result.approved).toBe(true);
      expect(result.score).toBe(85);
      expect(result.feedback).toContain('Good implementation');
      expect(result.suggestions).toContain('Consider adding error handling');

      expect(mockExecutor.sendPromptExpectJSON).toHaveBeenCalledWith(
        expect.stringContaining('task-001'),
        expect.objectContaining({
          timeout: 3000,
          appendSystemPrompt: expect.stringContaining('senior engineer')
        })
      );
    });

    it('should handle work that needs improvement', async () => {
      const workResult: WorkResult = {
        taskId: 'task-002',
        agentId: 'subordinate-002',
        codeChanges: [
          {
            filePath: 'src/broken.ts',
            action: 'CREATE',
            content: 'function broken() { return; }'
          }
        ],
        testResults: {
          testType: TestType.UNIT,
          passed: false,
          totalTests: 3,
          passedTests: 1,
          failedTests: 2,
          executionTime: 800,
          details: []
        },
        completionTime: new Date()
      };

      const mockReviewResponse = {
        approved: false,
        feedback: 'Code has significant issues and failed tests',
        suggestions: ['Fix failing tests', 'Improve error handling'],
        issues: [
          {
            severity: 'high' as const,
            description: 'Function returns undefined',
            file: 'src/broken.ts',
            line: 1
          }
        ],
        score: 45,
        codeQuality: {
          readability: 60,
          maintainability: 40,
          testCoverage: 30,
          performance: 50
        },
        recommendations: ['Rewrite the function', 'Add proper tests']
      };

      mockExecutor.sendPromptExpectJSON.mockResolvedValue(mockReviewResponse);

      const result = await controller.reviewSubordinateWork(workResult);

      expect(result.approved).toBe(false);
      expect(result.score).toBe(45);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.severity).toBe('high');
    });
  });

  describe('runIntegrationTests', () => {
    beforeEach(async () => {
      // 初期化を完了
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
      await controller.initialize();
    });

    it('should run backend integration tests successfully', async () => {
      const mockTestResponse = {
        testResults: {
          passed: true,
          totalTests: 20,
          passedTests: 19,
          failedTests: 1,
          executionTime: 5000,
          details: [
            {
              testName: 'API Integration Test',
              status: 'passed' as const,
              duration: 1200,
              error: undefined
            }
          ]
        },
        coverage: 87.5,
        performanceMetrics: {
          executionTime: 5000,
          memoryUsage: 256,
          cpuUsage: 45
        }
      };

      mockExecutor.sendPromptExpectJSON.mockResolvedValue(mockTestResponse);

      const result = await controller.runIntegrationTests('/test/project', 'backend');

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(20);
      expect(result.passedTests).toBe(19);
      expect(result.coverage).toBe(87.5);
      expect(result.performanceMetrics).toBeDefined();

      expect(mockExecutor.sendPromptExpectJSON).toHaveBeenCalledWith(
        expect.stringContaining('backend'),
        expect.objectContaining({
          timeout: 10000,
          workspacePath: '/test/project',
          allowedTools: expect.arrayContaining(['Bash', 'Edit'])
        })
      );
    });

    it('should handle test execution failures', async () => {
      mockExecutor.sendPromptExpectJSON.mockRejectedValue(new Error('Test execution timeout'));

      await expect(controller.runIntegrationTests('/test/project', 'frontend'))
        .rejects.toThrow('Test execution timeout');
    });
  });

  describe('addTasksToQueue', () => {
    beforeEach(async () => {
      // 初期化を完了
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
      await controller.initialize();
    });

    it('should add tasks to queue successfully', async () => {
      const tasks: Task[] = [
        {
          id: 'task-001',
          title: 'First Task',
          description: 'First task description',
          priority: 8,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          dependencies: []
        },
        {
          id: 'task-002',
          title: 'Second Task',
          description: 'Second task description',
          priority: 5,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          dependencies: ['task-001']
        }
      ];

      mockTaskQueue.addTask.mockResolvedValueOnce('job-001');
      mockTaskQueue.addTask.mockResolvedValueOnce('job-002');

      const jobIds = await controller.addTasksToQueue(tasks);

      expect(jobIds).toHaveLength(2);
      expect(jobIds).toEqual(['job-001', 'job-002']);
      expect(mockTaskQueue.addTask).toHaveBeenCalledTimes(2);
    });

    it('should handle queue errors', async () => {
      const tasks: Task[] = [{
        id: 'task-fail',
        title: 'Failing Task',
        description: 'This task will fail',
        priority: 1,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        dependencies: []
      }];

      mockTaskQueue.addTask.mockRejectedValue(new Error('Queue is full'));

      await expect(controller.addTasksToQueue(tasks)).rejects.toThrow('Queue is full');
    });
  });

  describe('getStatus', () => {
    it('should return controller status', () => {
      const status = controller.getStatus();

      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('executorStats');
      expect(status).toHaveProperty('queueStatus');
      expect(status).toHaveProperty('activeInstructions');
      expect(status).toHaveProperty('taskHistory');
      expect(status).toHaveProperty('reviewHistory');
      expect(status).toHaveProperty('config');
      expect(status.config.workspacePath).toBe('/test/workspace');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      mockExecutor.cleanup.mockResolvedValue(undefined);
      mockTaskQueue.close.mockResolvedValue(undefined);

      await expect(controller.cleanup()).resolves.not.toThrow();

      expect(mockExecutor.cleanup).toHaveBeenCalled();
      expect(mockTaskQueue.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      mockExecutor.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      await expect(controller.cleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      const instruction: UserInstruction = {
        id: 'test-001',
        content: 'Test instruction',
        priority: 5,
        timestamp: new Date()
      };

      await expect(controller.processUserInstruction(instruction))
        .rejects.toThrow('Boss Controller is not initialized');
    });
  });

  describe('event emission', () => {
    it('should emit events during operations', async () => {
      const eventSpy = jest.fn();
      controller.on('initialized', eventSpy);
      controller.on('tasks-created', eventSpy);

      // 初期化
      mockExecutor.checkAvailability.mockResolvedValue(true);
      mockExecutor.setupWorkspace.mockResolvedValue(undefined);
      mockExecutor.sendPrompt.mockResolvedValue('Boss Controller initialized successfully');
      mockTaskQueue.initialize.mockResolvedValue(undefined);
      mockTaskQueue.getStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });

      await controller.initialize();

      expect(eventSpy).toHaveBeenCalledWith(); // initialized event

      // タスク作成
      const instruction: UserInstruction = {
        id: 'event-test',
        content: 'Test for events',
        priority: 5,
        timestamp: new Date()
      };

      const mockResponse = {
        tasks: [{
          title: 'Test Task',
          description: 'Test task for events',
          priority: 5,
          estimatedDuration: 30,
          dependencies: [],
          requiredSkills: ['TypeScript'],
          acceptanceCriteria: ['Task should emit events']
        }],
        dependencies: {},
        estimatedDuration: 30,
        complexity: 'low' as const
      };

      mockExecutor.sendPromptExpectJSON.mockResolvedValue(mockResponse);

      await controller.processUserInstruction(instruction);

      expect(eventSpy).toHaveBeenCalledWith('event-test', expect.any(Object)); // tasks-created event
    });
  });
});
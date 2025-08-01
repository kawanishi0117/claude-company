/**
 * Subordinate Controller Test Suite
 */

import { SubordinateController } from '../subordinate-controller';
import { ClaudeCommandExecutor } from '../../claude/command-executor';
import { TaskQueue } from '../../queue/task-queue';
import { Task, TaskStatus, TestType, CodeChange } from '../../models/types';

// モック
jest.mock('../../claude/command-executor');
jest.mock('../../queue/task-queue');
jest.mock('../../models/validation', () => ({
  validateTask: jest.fn((task) => task),
  validateWorkResult: jest.fn((result) => result)
}));

const MockClaudeCommandExecutor = ClaudeCommandExecutor as jest.MockedClass<typeof ClaudeCommandExecutor>;
const MockTaskQueue = TaskQueue as jest.MockedClass<typeof TaskQueue>;

describe('SubordinateController', () => {
  let controller: SubordinateController;
  let mockExecutor: jest.Mocked<ClaudeCommandExecutor>;
  let mockTaskQueue: jest.Mocked<TaskQueue>;

  const testConfig = {
    agentId: 'sub-001',
    workspacePath: '/test/workspace',
    taskTimeout: 5000,
    testTimeout: 3000
  };

  const createTestTask = (overrides = {}): Task => ({
    id: 'task-123',
    title: 'Test Task',
    description: 'Test task description',
    priority: 5,
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    dependencies: [],
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // ClaudeCommandExecutorのモック設定
    mockExecutor = {
      checkAvailability: jest.fn().mockResolvedValue(true),
      createMcpConfig: jest.fn().mockResolvedValue('/test/mcp-config.json'),
      setupWorkspace: jest.fn().mockResolvedValue(undefined),
      sendPromptExpectJSON: jest.fn(),
      sendPrompt: jest.fn(),
      getStats: jest.fn().mockReturnValue({}),
      cleanup: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    MockClaudeCommandExecutor.mockImplementation(() => mockExecutor);

    // TaskQueueのモック設定
    mockTaskQueue = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getNextTask: jest.fn(),
      submitResult: jest.fn().mockResolvedValue('job-123'),
      getStats: jest.fn().mockResolvedValue({ waiting: 0 }),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    } as any;

    MockTaskQueue.mockImplementation(() => mockTaskQueue);

    controller = new SubordinateController(testConfig);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await controller.initialize();

      expect(mockExecutor.checkAvailability).toHaveBeenCalled();
      expect(mockExecutor.createMcpConfig).toHaveBeenCalled();
      expect(mockExecutor.setupWorkspace).toHaveBeenCalledWith('/test/workspace');
      expect(mockTaskQueue.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await controller.initialize();
      await controller.initialize();

      expect(mockExecutor.checkAvailability).toHaveBeenCalledTimes(1);
    });

    it('should handle Claude CLI unavailable', async () => {
      mockExecutor.checkAvailability.mockResolvedValueOnce(false);

      await expect(controller.initialize()).rejects.toThrow('Claude Code CLI is not available');
    });
  });

  describe('fetchAndExecuteTask', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should fetch and execute task successfully', async () => {
      const testTask = createTestTask();
      mockTaskQueue.getNextTask.mockResolvedValueOnce(testTask);

      mockExecutor.sendPromptExpectJSON
        .mockResolvedValueOnce({
          // Task execution response
          success: true,
          codeChanges: [{
            filePath: 'src/test.ts',
            action: 'CREATE',
            content: 'console.log("test");',
            summary: 'Created test file'
          }],
          executionSteps: ['Created test.ts file']
        })
        .mockResolvedValueOnce({
          // Unit test response
          testsCreated: 2,
          testsExecuted: 2,
          testsPassed: 2,
          testsFailed: 0,
          executionTime: 100,
          testDetails: [{
            name: 'test case 1',
            passed: true,
            duration: 50
          }]
        });

      const result = await controller.fetchAndExecuteTask();

      expect(result).not.toBeNull();
      expect(result?.taskId).toBe(testTask.id);
      expect(result?.agentId).toBe('sub-001');
      expect(result?.codeChanges).toHaveLength(1);
      expect(result?.testResults.passed).toBe(true);
    });

    it('should return null when no tasks available', async () => {
      mockTaskQueue.getNextTask.mockResolvedValueOnce(null);

      const result = await controller.fetchAndExecuteTask();

      expect(result).toBeNull();
    });

    it('should handle task execution failure', async () => {
      const testTask = createTestTask();
      mockTaskQueue.getNextTask.mockResolvedValueOnce(testTask);

      mockExecutor.sendPromptExpectJSON.mockRejectedValueOnce(new Error('Execution failed'));

      await expect(controller.fetchAndExecuteTask()).rejects.toThrow('Execution failed');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should execute task successfully', async () => {
      const testTask = createTestTask();

      mockExecutor.sendPromptExpectJSON.mockResolvedValueOnce({
        success: true,
        codeChanges: [{
          filePath: 'src/feature.ts',
          action: 'CREATE',
          content: 'export function feature() {}',
          summary: 'Implemented feature'
        }],
        executionSteps: ['Step 1', 'Step 2']
      });

      const result = await controller.executeTask(testTask);

      expect(result.success).toBe(true);
      expect(result.codeChanges).toHaveLength(1);
      expect(result.logs).toContain('Step 1');
      expect(result.logs).toContain('Step 2');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle execution errors', async () => {
      const testTask = createTestTask();

      mockExecutor.sendPromptExpectJSON.mockRejectedValueOnce(new Error('API error'));

      const result = await controller.executeTask(testTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.codeChanges).toHaveLength(0);
    });
  });

  describe('runUnitTests', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should run unit tests successfully', async () => {
      const testTask = createTestTask();
      const codeChanges = [{
        filePath: 'src/calculator.ts',
        action: 'CREATE' as const,
        content: 'export function add(a: number, b: number) { return a + b; }'
      }];

      mockExecutor.sendPromptExpectJSON.mockResolvedValueOnce({
        testsCreated: 3,
        testsExecuted: 3,
        testsPassed: 3,
        testsFailed: 0,
        executionTime: 150,
        testDetails: [
          { name: 'add should return sum', passed: true, duration: 50 },
          { name: 'add handles negative numbers', passed: true, duration: 45 },
          { name: 'add handles zero', passed: true, duration: 55 }
        ],
        coverage: 100
      });

      const result = await controller.runUnitTests(testTask, codeChanges);

      expect(result.testType).toBe(TestType.UNIT);
      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(3);
      expect(result.passedTests).toBe(3);
      expect(result.failedTests).toBe(0);
      expect(result.details).toHaveLength(3);
    });

    it('should handle test failures', async () => {
      const testTask = createTestTask();
      const codeChanges: CodeChange[] = [];

      mockExecutor.sendPromptExpectJSON.mockResolvedValueOnce({
        testsCreated: 2,
        testsExecuted: 2,
        testsPassed: 1,
        testsFailed: 1,
        executionTime: 100,
        testDetails: [
          { name: 'test 1', passed: true, duration: 50 },
          { name: 'test 2', passed: false, duration: 50, error: 'Assertion failed' }
        ]
      });

      const result = await controller.runUnitTests(testTask, codeChanges);

      expect(result.passed).toBe(false);
      expect(result.failedTests).toBe(1);
    });

    it('should handle test execution errors', async () => {
      const testTask = createTestTask();
      const codeChanges: CodeChange[] = [];

      mockExecutor.sendPromptExpectJSON.mockRejectedValueOnce(new Error('Test runner error'));

      const result = await controller.runUnitTests(testTask, codeChanges);

      expect(result.passed).toBe(false);
      expect(result.totalTests).toBe(0);
      expect(result.details[0]?.error).toContain('Test runner error');
    });
  });

  describe('submitWorkResult', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should submit work result successfully', async () => {
      const workResult = {
        taskId: 'task-123',
        agentId: 'sub-001',
        codeChanges: [],
        testResults: {
          testType: TestType.UNIT,
          passed: true,
          totalTests: 1,
          passedTests: 1,
          failedTests: 0,
          executionTime: 100,
          details: []
        },
        completionTime: new Date()
      };

      await controller.submitWorkResult(workResult);

      expect(mockTaskQueue.submitResult).toHaveBeenCalledWith(workResult);
    });

    it('should handle submission errors', async () => {
      const workResult = {
        taskId: 'task-123',
        agentId: 'sub-001',
        codeChanges: [],
        testResults: {
          testType: TestType.UNIT,
          passed: true,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          executionTime: 0,
          details: []
        },
        completionTime: new Date()
      };

      mockTaskQueue.submitResult.mockRejectedValueOnce(new Error('Queue error'));

      await expect(controller.submitWorkResult(workResult))
        .rejects.toThrow('Queue error');
    });
  });

  describe('getStatus', () => {
    it('should return controller status', async () => {
      await controller.initialize();

      const status = controller.getStatus();

      expect(status.agentId).toBe('sub-001');
      expect(status.isInitialized).toBe(true);
      expect(status.currentTask).toBeNull();
      expect(status.config.workspacePath).toBe('/test/workspace');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await controller.initialize();
      
      // タスクを実行中にする
      const testTask = createTestTask();
      mockTaskQueue.getNextTask.mockResolvedValueOnce(testTask);

      // cleanupを別のPromiseで実行
      const cleanupPromise = controller.cleanup();

      await cleanupPromise;

      expect(mockExecutor.cleanup).toHaveBeenCalled();
      expect(mockTaskQueue.close).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('should emit task events', async () => {
      await controller.initialize();

      const taskStartedHandler = jest.fn();
      const taskCompletedHandler = jest.fn();
      
      controller.on('task-started', taskStartedHandler);
      controller.on('task-completed', taskCompletedHandler);

      const testTask = createTestTask();
      mockTaskQueue.getNextTask.mockResolvedValueOnce(testTask);

      mockExecutor.sendPromptExpectJSON
        .mockResolvedValueOnce({
          success: true,
          codeChanges: [],
          executionSteps: []
        })
        .mockResolvedValueOnce({
          testsCreated: 0,
          testsExecuted: 0,
          testsPassed: 0,
          testsFailed: 0,
          executionTime: 0,
          testDetails: []
        });

      await controller.fetchAndExecuteTask();

      expect(taskStartedHandler).toHaveBeenCalledWith(testTask);
      expect(taskCompletedHandler).toHaveBeenCalled();
    });
  });
});
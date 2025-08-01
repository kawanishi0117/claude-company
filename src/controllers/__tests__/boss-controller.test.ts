/**
 * Boss Controller Unit Tests
 */

import { BossController, UserInstruction } from '../boss-controller';
import { ClaudeProcessManager, ClaudeCommunicationInterface } from '../../claude';
import { TaskQueue } from '../../queue/task-queue';
import { WorkResult, TestType } from '../../models/types';

// モックの設定
jest.mock('../../claude/process-manager');
jest.mock('../../claude/communication-interface');
jest.mock('../../queue/task-queue');

describe('BossController', () => {
  let bossController: BossController;

  const testConfig = {
    workspacePath: '/test/workspace',
    maxConcurrentTasks: 5,
    taskTimeout: 30000,
    reviewTimeout: 15000,
    integrationTestTimeout: 60000
  };

  beforeEach(() => {
    // ClaudeProcessManagerのモック
    (ClaudeProcessManager as jest.MockedClass<typeof ClaudeProcessManager>).mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      getProcessInfo: jest.fn().mockReturnValue({
        status: 'RUNNING',
        pid: 1234,
        restartCount: 0,
        errorCount: 0
      }),
      isRunning: jest.fn().mockReturnValue(true),
      cleanup: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    } as any));

    // ClaudeCommunicationInterfaceのモック
    (ClaudeCommunicationInterface as jest.MockedClass<typeof ClaudeCommunicationInterface>).mockImplementation(() => ({
      sendPrompt: jest.fn(),
      sendPromptExpectJSON: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        isProcessRunning: true,
        pendingCommands: 0,
        queuedCommands: 0,
        isProcessingQueue: false
      }),
      getDetailedStats: jest.fn().mockReturnValue({
        metrics: {
          totalCommands: 0,
          successfulCommands: 0,
          failedCommands: 0,
          averageExecutionTime: 0
        }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    } as any));

    // TaskQueueのモック
    (TaskQueue as jest.MockedClass<typeof TaskQueue>).mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      }),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    } as any));

    bossController = new BossController(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    it('正常に初期化できること', async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });

      await bossController.initialize();
      
      const status = bossController.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    it('初期化エラーが適切に処理されること', async () => {
      const mockStart = jest.fn().mockRejectedValue(new Error('Process start failed'));
      (bossController as any).processManager.start = mockStart;

      await expect(bossController.initialize()).rejects.toThrow('Process start failed');
    });
  });

  describe('ユーザー指示処理', () => {
    const testInstruction: UserInstruction = {
      id: 'test-instruction-1',
      content: 'Create a REST API for user management',
      priority: 5,
      timestamp: new Date(),
      userId: 'user-1',
      projectId: 'project-1'
    };

    beforeEach(async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      await bossController.initialize();
    });

    it('ユーザー指示を正常にタスクに分解できること', async () => {
      const mockResponse = {
        tasks: [
          {
            title: 'Create User Model',
            description: 'Create TypeScript interface for User',
            priority: 8,
            estimatedDuration: 60,
            dependencies: [],
            requiredSkills: ['TypeScript'],
            acceptanceCriteria: ['User interface defined', 'Validation included']
          },
          {
            title: 'Create User Controller',
            description: 'Create REST API endpoints for user operations',
            priority: 7,
            estimatedDuration: 120,
            dependencies: ['Create User Model'],
            requiredSkills: ['TypeScript', 'Express.js'],
            acceptanceCriteria: ['CRUD endpoints implemented', 'Error handling included']
          }
        ],
        dependencies: {
          'Create User Controller': ['Create User Model']
        },
        estimatedDuration: 180,
        complexity: 'medium' as const
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.processUserInstruction(testInstruction);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]?.title).toBe('Create User Model');
      expect(result.tasks[1]?.title).toBe('Create User Controller');
      expect(result.dependencies.size).toBe(1);
      expect(result.complexity).toBe('medium');
    });

    it('無効な指示に対してエラーが発生すること', async () => {
      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockRejectedValue(new Error('Invalid instruction'));

      await expect(bossController.processUserInstruction(testInstruction)).rejects.toThrow('Invalid instruction');
    });
  });

  describe('コードレビュー', () => {
    const testWorkResult: WorkResult = {
      taskId: 'task-1',
      agentId: 'subordinate-1',
      codeChanges: [
        {
          filePath: 'src/user.ts',
          action: 'CREATE' as const,
          content: 'export interface User { id: string; name: string; }'
        }
      ],
      testResults: {
        testType: TestType.UNIT,
        passed: true,
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        executionTime: 1000,
        details: []
      },
      completionTime: new Date()
    };

    beforeEach(async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      await bossController.initialize();
    });

    it('コードレビューを正常に実行できること', async () => {
      const mockResponse = {
        approved: true,
        feedback: 'Code looks good with proper TypeScript interfaces',
        suggestions: ['Consider adding JSDoc comments'],
        issues: [],
        score: 85,
        codeQuality: {
          readability: 90,
          maintainability: 85,
          testCoverage: 80,
          performance: 90
        },
        recommendations: ['Add input validation']
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.reviewSubordinateWork(testWorkResult);

      expect(result.approved).toBe(true);
      expect(result.score).toBe(85);
      expect(result.feedback).toContain('Code looks good');
      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('結合テスト', () => {
    beforeEach(async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      await bossController.initialize();
    });

    it('バックエンド結合テストを正常に実行できること', async () => {
      const mockResponse = {
        testResults: {
          passed: true,
          totalTests: 15,
          passedTests: 14,
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
        coverage: 85.5,
        performanceMetrics: {
          executionTime: 5000,
          memoryUsage: 256,
          cpuUsage: 45
        }
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.runIntegrationTests('/test/project', 'backend');

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(15);
      expect(result.coverage).toBe(85.5);
      expect(result.performanceMetrics).toBeDefined();
    });
  });

  describe('状態管理', () => {
    it('初期化前の状態を正しく返すこと', () => {
      const status = bossController.getStatus();
      
      expect(status.isInitialized).toBe(false);
      expect(status.activeInstructions).toBe(0);
      expect(status.taskHistory).toBe(0);
      expect(status.reviewHistory).toBe(0);
    });

    it('初期化後の状態を正しく返すこと', async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      
      await bossController.initialize();
      
      const status = bossController.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.processStatus).toBeDefined();
      expect(status.communicationStatus).toBeDefined();
      expect(status.queueStatus).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    it('初期化前の操作でエラーが発生すること', async () => {
      const testInstruction: UserInstruction = {
        id: 'test-instruction',
        content: 'Test instruction',
        priority: 5,
        timestamp: new Date()
      };

      await expect(bossController.processUserInstruction(testInstruction)).rejects.toThrow('Boss Controller is not initialized');
    });
  });

  describe('タスク割り振り', () => {
    beforeEach(async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      await bossController.initialize();
    });

    it('タスクをキューに正常に追加できること', async () => {
      const testTasks = [
        {
          id: 'task-1',
          title: 'Test Task 1',
          description: 'First test task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: []
        },
        {
          id: 'task-2',
          title: 'Test Task 2',
          description: 'Second test task',
          priority: 7,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: ['task-1']
        }
      ];

      // TaskQueueのaddTaskメソッドをモック
      (bossController as any).taskQueue.addTask = jest.fn()
        .mockResolvedValueOnce('job-1')
        .mockResolvedValueOnce('job-2');

      const jobIds = await bossController.addTasksToQueue(testTasks);

      expect(jobIds).toHaveLength(2);
      expect(jobIds[0]).toBe('job-1');
      expect(jobIds[1]).toBe('job-2');
      expect((bossController as any).taskQueue.addTask).toHaveBeenCalledTimes(2);
    });

    it('部下AIにタスクを分散できること', async () => {
      // getNextTaskメソッドをモック
      (bossController as any).taskQueue.getNextTask = jest.fn().mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        description: 'Test task for distribution',
        priority: 5,
        status: 'PENDING',
        createdAt: new Date(),
        dependencies: []
      });

      // getStatsメソッドをモック
      (bossController as any).taskQueue.getStats = jest.fn().mockResolvedValue({
        waiting: 1,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      });

      await bossController.distributeTasksToSubordinates();

      expect((bossController as any).taskQueue.getNextTask).toHaveBeenCalled();
    });

    it('タスクの依存関係を正しく処理できること', async () => {
      const testTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: []
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: ['task-1']
        },
        {
          id: 'task-3',
          title: 'Task 3',
          description: 'Third task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: ['task-1', 'task-2']
        }
      ];

      const sortedTasks = await bossController.enforceTaskDependencies(testTasks);

      expect(sortedTasks).toHaveLength(3);
      // task-1が最初に来ることを確認
      expect(sortedTasks[0]?.id).toBe('task-1');
      // task-3が最後に来ることを確認（task-1とtask-2に依存）
      expect(sortedTasks[2]?.id).toBe('task-3');
    });

    it('循環依存を検出してエラーを発生させること', async () => {
      const testTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: ['task-2']
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          priority: 5,
          status: 'PENDING' as any,
          createdAt: new Date(),
          dependencies: ['task-1']
        }
      ];

      await expect(bossController.enforceTaskDependencies(testTasks)).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('コードレビューと結合テスト', () => {
    beforeEach(async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      await bossController.initialize();
    });

    it('コードに問題がある場合、適切にレビュー結果を返すこと', async () => {
      const testWorkResult: WorkResult = {
        taskId: 'task-1',
        agentId: 'subordinate-1',
        codeChanges: [
          {
            filePath: 'src/user.ts',
            action: 'CREATE' as const,
            content: 'export interface User { id: string; name: string; }'
          }
        ],
        testResults: {
          testType: TestType.UNIT,
          passed: false,
          totalTests: 5,
          passedTests: 3,
          failedTests: 2,
          executionTime: 1000,
          details: []
        },
        completionTime: new Date()
      };

      const mockResponse = {
        approved: false,
        feedback: 'Code has several issues that need to be addressed',
        suggestions: ['Fix error handling', 'Add input validation'],
        issues: [
          {
            severity: 'high' as const,
            description: 'Missing error handling',
            file: 'src/user.ts',
            line: 10
          }
        ],
        score: 45,
        codeQuality: {
          readability: 60,
          maintainability: 40,
          testCoverage: 30,
          performance: 70
        },
        recommendations: ['Refactor error handling', 'Add comprehensive tests']
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.reviewSubordinateWork(testWorkResult);

      expect(result.approved).toBe(false);
      expect(result.score).toBe(45);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.severity).toBe('high');
      expect(result.suggestions).toHaveLength(2);
    });

    it('フロントエンド結合テストを正常に実行できること', async () => {
      const mockResponse = {
        testResults: {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          executionTime: 8000,
          details: [
            {
              testName: 'Frontend Integration Test',
              status: 'passed' as const,
              duration: 2000,
              error: undefined
            }
          ]
        },
        coverage: 75.0,
        browserTestResults: {
          passed: true,
          screenshots: ['test1.png', 'test2.png'],
          errors: []
        }
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.runIntegrationTests('/test/project', 'frontend');

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(10);
      expect(result.coverage).toBe(75.0);
      expect(result.browserTestResults).toBeDefined();
      expect(result.browserTestResults?.screenshots).toHaveLength(2);
    });

    it('フルスタック結合テストを正常に実行できること', async () => {
      const mockResponse = {
        testResults: {
          passed: true,
          totalTests: 25,
          passedTests: 24,
          failedTests: 1,
          executionTime: 15000,
          details: [
            {
              testName: 'Full Stack Integration Test',
              status: 'passed' as const,
              duration: 5000,
              error: undefined
            }
          ]
        },
        coverage: 88.5,
        performanceMetrics: {
          executionTime: 15000,
          memoryUsage: 512,
          cpuUsage: 65
        },
        browserTestResults: {
          passed: true,
          screenshots: ['fullstack-test.png'],
          errors: []
        }
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.runIntegrationTests('/test/project', 'full');

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(25);
      expect(result.coverage).toBe(88.5);
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.memoryUsage).toBe(512);
      expect(result.browserTestResults).toBeDefined();
    });

    it('ブラウザテストでエラーが発生した場合、適切に処理すること', async () => {
      const testScenarios = [
        'User login flow',
        'Create new user',
        'Update user profile'
      ];

      const mockResponse = {
        testResults: {
          passed: false,
          totalTests: 3,
          passedTests: 2,
          failedTests: 1,
          executionTime: 12000,
          details: [
            {
              testName: 'User login flow',
              status: 'passed' as const,
              duration: 4000,
              error: undefined,
              screenshot: 'login-test.png'
            },
            {
              testName: 'Create new user',
              status: 'failed' as const,
              duration: 3000,
              error: 'Element not found: #create-user-button',
              screenshot: 'create-user-error.png'
            }
          ]
        },
        browserTestResults: {
          passed: false,
          screenshots: ['login-test.png', 'create-user-error.png'],
          errors: ['Element not found: #create-user-button'],
          performanceMetrics: {
            loadTime: 1500,
            renderTime: 900,
            interactionTime: 200
          }
        }
      };

      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockResolvedValue(mockResponse);

      const result = await bossController.runBrowserTests('/test/project', testScenarios);

      expect(result.passed).toBe(false);
      expect(result.totalTests).toBe(3);
      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(1);
      expect(result.browserTestResults?.errors).toHaveLength(1);
      expect(result.browserTestResults?.errors?.[0]).toContain('Element not found');
    });

    it('結合テストでタイムアウトが発生した場合、適切にエラーを処理すること', async () => {
      (bossController as any).communicationInterface.sendPromptExpectJSON = jest.fn().mockRejectedValue(new Error('Test execution timeout'));

      await expect(bossController.runIntegrationTests('/test/project', 'backend')).rejects.toThrow('Test execution timeout');
    });
  });

  describe('クリーンアップ', () => {
    it('リソースを正常にクリーンアップできること', async () => {
      // 初期化確認用のモックレスポンス
      (bossController as any).communicationInterface.sendPrompt = jest.fn().mockResolvedValue({
        success: true,
        data: 'Boss Controller initialized successfully'
      });
      
      await bossController.initialize();
      await bossController.cleanup();

      const status = bossController.getStatus();
      expect(status.isInitialized).toBe(false);
    });
  });
});
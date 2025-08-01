/**
 * Subordinate AI Controller
 * タスク実行、単体テスト作成・実行、成果物提出を担当
 */

import { EventEmitter } from 'events';
import { ClaudeCommandExecutor } from '../claude/command-executor';
import { TaskQueue } from '../queue/task-queue';
import { Task, WorkResult, TestResult, LogLevel, TestType, CodeChange } from '../models/types';
import { validateWorkResult } from '../models/validation';
import { join } from 'path';

export interface SubordinateControllerConfig {
  agentId: string;
  workspacePath: string;
  taskTimeout?: number;
  testTimeout?: number;
  mcpServers?: Record<string, { command: string; args: string[] }>;
}

export interface TaskExecutionResult {
  success: boolean;
  codeChanges: CodeChange[];
  testResults?: TestResult;
  logs: string[];
  executionTime: number;
  error?: string;
}

export class SubordinateController extends EventEmitter {
  private claudeExecutor: ClaudeCommandExecutor;
  private taskQueue: TaskQueue;
  private config: Required<SubordinateControllerConfig>;
  private isInitialized: boolean = false;
  private currentTask: Task | null = null;
  private executionHistory: Map<string, TaskExecutionResult> = new Map();
  private mcpConfigPath?: string;

  constructor(config: SubordinateControllerConfig) {
    super();
    
    this.config = {
      agentId: config.agentId,
      workspacePath: config.workspacePath,
      taskTimeout: config.taskTimeout || 600000, // 10分
      testTimeout: config.testTimeout || 300000, // 5分
      mcpServers: config.mcpServers || {
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', config.workspacePath]
        }
      }
    };

    // ClaudeCommandExecutorの初期化
    this.claudeExecutor = new ClaudeCommandExecutor({
      defaultTimeout: this.config.taskTimeout,
      defaultWorkspacePath: this.config.workspacePath
    });

    this.taskQueue = new TaskQueue();
    
    this.setupEventListeners();
  }

  /**
   * Subordinate Controllerを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log(LogLevel.INFO, `Initializing Subordinate Controller for agent: ${this.config.agentId}`);

      // Claude Code CLIの利用可能性確認
      const available = await this.claudeExecutor.checkAvailability();
      if (!available) {
        throw new Error('Claude Code CLI is not available');
      }

      // MCPサーバー設定をセットアップ
      if (this.config.mcpServers && Object.keys(this.config.mcpServers).length > 0) {
        this.mcpConfigPath = await this.claudeExecutor.createMcpConfig(
          this.config.mcpServers,
          join(this.config.workspacePath, `.mcp-config-${this.config.agentId}.json`)
        );
      }

      // ワークスペースのセットアップ
      await this.claudeExecutor.setupWorkspace(this.config.workspacePath);
      
      // タスクキューを初期化
      await this.taskQueue.initialize();

      this.isInitialized = true;
      this.emit('initialized', this.config.agentId);
      
      this.log(LogLevel.INFO, `Subordinate Controller ${this.config.agentId} initialized successfully`);
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to initialize Subordinate Controller: ${error}`);
      throw error;
    }
  }

  /**
   * タスクキューからタスクを取得して実行
   */
  async fetchAndExecuteTask(): Promise<WorkResult | null> {
    this.ensureInitialized();

    try {
      // タスクキューから次のタスクを取得
      const task = await this.taskQueue.getNextTask(this.config.agentId);
      
      if (!task) {
        this.log(LogLevel.DEBUG, 'No tasks available in queue');
        return null;
      }

      this.currentTask = task;
      this.emit('task-started', task);

      // タスクを実行
      const executionResult = await this.executeTask(task);

      // 単体テストを実行
      const testResult = await this.runUnitTests(task, executionResult.codeChanges);

      // 成果物を作成
      const workResult: WorkResult = {
        taskId: task.id,
        agentId: this.config.agentId,
        codeChanges: executionResult.codeChanges,
        testResults: testResult,
        completionTime: new Date()
      };

      // バリデーション
      const validatedResult = validateWorkResult(workResult);

      // 実行履歴に記録
      this.executionHistory.set(task.id, {
        ...executionResult,
        testResults: testResult
      });

      this.currentTask = null;
      this.emit('task-completed', task, validatedResult);

      return validatedResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to execute task: ${error}`);
      
      if (this.currentTask) {
        this.emit('task-failed', this.currentTask, error);
        this.currentTask = null;
      }
      
      throw error;
    }
  }

  /**
   * 指定されたタスクを実行
   */
  async executeTask(task: Task): Promise<TaskExecutionResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const logs: string[] = [];

    try {
      this.log(LogLevel.INFO, `Executing task ${task.id}: ${task.title}`);
      logs.push(`Starting task execution: ${task.title}`);

      // タスク実行プロンプトを構築
      const prompt = this.buildTaskExecutionPrompt(task);

      // Claude Code CLIでタスクを実行
      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        success: boolean;
        codeChanges: Array<{
          filePath: string;
          action: 'CREATE' | 'UPDATE' | 'DELETE';
          content?: string;
          diff?: string;
          summary: string;
        }>;
        executionSteps: string[];
        challenges?: string[];
        nextSteps?: string[];
      }>(prompt, {
        timeout: this.config.taskTimeout,
        ...(this.mcpConfigPath && { mcpConfig: this.mcpConfigPath }),
        allowedTools: ['Bash', 'Edit', 'Create', 'Delete', 'mcp__filesystem__read_file', 'mcp__filesystem__write_file'],
        appendSystemPrompt: `You are a skilled developer working on task "${task.title}". Focus on writing clean, maintainable, and well-tested code.`
      });

      // 実行ステップをログに追加
      if (response.executionSteps) {
        logs.push(...response.executionSteps);
      }

      const executionTime = Date.now() - startTime;

      const result: TaskExecutionResult = {
        success: response.success,
        codeChanges: response.codeChanges.map(change => ({
          filePath: change.filePath,
          action: change.action,
          ...(change.content && { content: change.content }),
          ...(change.diff && { diff: change.diff })
        })),
        logs,
        executionTime,
        ...(!response.success && { error: 'Task execution failed' })
      };

      this.log(LogLevel.INFO, `Task ${task.id} execution ${response.success ? 'succeeded' : 'failed'} in ${executionTime}ms`);
      
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.log(LogLevel.ERROR, `Task execution failed: ${error}`);
      logs.push(`Error: ${error}`);

      return {
        success: false,
        codeChanges: [],
        logs,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 単体テストを実行
   */
  async runUnitTests(task: Task, codeChanges: CodeChange[]): Promise<TestResult> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Running unit tests for task ${task.id}`);

      // テスト実行プロンプトを構築
      const prompt = this.buildUnitTestPrompt(task, codeChanges);

      // Claude Code CLIでテストを実行
      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        testsCreated: number;
        testsExecuted: number;
        testsPassed: number;
        testsFailed: number;
        executionTime: number;
        testDetails: Array<{
          name: string;
          passed: boolean;
          duration: number;
          error?: string;
          file?: string;
        }>;
        coverage?: number;
      }>(prompt, {
        timeout: this.config.testTimeout,
        ...(this.mcpConfigPath && { mcpConfig: this.mcpConfigPath }),
        allowedTools: ['Bash', 'Edit', 'Create', 'mcp__filesystem__read_file', 'mcp__filesystem__write_file'],
        appendSystemPrompt: 'You are writing comprehensive unit tests. Ensure good test coverage and meaningful test cases.'
      });

      const testResult: TestResult = {
        testType: TestType.UNIT,
        passed: response.testsPassed === response.testsExecuted && response.testsFailed === 0,
        totalTests: response.testsExecuted,
        passedTests: response.testsPassed,
        failedTests: response.testsFailed,
        executionTime: response.executionTime,
        details: response.testDetails.map(detail => ({
          name: detail.name,
          passed: detail.passed,
          duration: detail.duration,
          error: detail.error || ''
        }))
      };

      this.log(LogLevel.INFO, `Unit tests completed: ${testResult.passed ? 'PASSED' : 'FAILED'} (${testResult.passedTests}/${testResult.totalTests})`);

      return testResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to run unit tests: ${error}`);
      
      // エラー時のデフォルトテスト結果
      return {
        testType: TestType.UNIT,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        executionTime: 0,
        details: [{
          name: 'Test Execution Failed',
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        }]
      };
    }
  }

  /**
   * 成果物をBoss AIに提出
   */
  async submitWorkResult(workResult: WorkResult): Promise<void> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Submitting work result for task ${workResult.taskId}`);

      // バリデーション
      const validatedResult = validateWorkResult(workResult);

      // タスクキューの結果キューに追加
      await this.taskQueue.submitResult(validatedResult);

      this.emit('work-submitted', validatedResult);
      this.log(LogLevel.INFO, `Work result submitted successfully for task ${workResult.taskId}`);

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to submit work result: ${error}`);
      throw error;
    }
  }

  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      agentId: this.config.agentId,
      isInitialized: this.isInitialized,
      currentTask: this.currentTask,
      executorStats: this.claudeExecutor.getStats(),
      executionHistory: this.executionHistory.size,
      config: {
        workspacePath: this.config.workspacePath,
        taskTimeout: this.config.taskTimeout,
        testTimeout: this.config.testTimeout
      }
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      this.log(LogLevel.INFO, `Cleaning up Subordinate Controller ${this.config.agentId}`);

      // 現在のタスクがあれば中断
      if (this.currentTask) {
        this.emit('task-interrupted', this.currentTask);
        this.currentTask = null;
      }

      // Claude Executorのクリーンアップ
      await this.claudeExecutor.cleanup();
      
      // タスクキューのクリーンアップ
      await this.taskQueue.close();

      // イベントリスナーの削除
      this.removeAllListeners();

      this.isInitialized = false;
      this.log(LogLevel.INFO, `Subordinate Controller ${this.config.agentId} cleanup completed`);
      
    } catch (error) {
      this.log(LogLevel.ERROR, `Error during Subordinate Controller cleanup: ${error}`);
      throw error;
    }
  }

  /**
   * タスク実行プロンプトを構築
   */
  private buildTaskExecutionPrompt(task: Task): string {
    return `
以下のタスクを実行してください。

## タスク情報
- ID: ${task.id}
- タイトル: ${task.title}
- 説明: ${task.description}
- 優先度: ${task.priority}

## 実行要件
1. タスクの要件を満たすコードを実装してください
2. 必要なファイルの作成・編集・削除を行ってください
3. コードは読みやすく、保守しやすいものにしてください
4. エラーハンドリングを適切に実装してください
5. 各ステップで何を行ったか記録してください

## 出力形式
以下のJSON形式で結果を返してください：

\`\`\`json
{
  "success": true,
  "codeChanges": [
    {
      "filePath": "src/example.ts",
      "action": "CREATE",
      "content": "完全なファイル内容",
      "diff": "差分（UPDATEの場合）",
      "summary": "変更の概要"
    }
  ],
  "executionSteps": [
    "1. ファイルsrc/example.tsを作成",
    "2. 関数implementFeatureを実装",
    "3. エラーハンドリングを追加"
  ],
  "challenges": [
    "遭遇した課題（あれば）"
  ],
  "nextSteps": [
    "次に必要なステップ（あれば）"
  ]
}
\`\`\`

タスクを正確に理解し、高品質なコードを実装してください。
`;
  }

  /**
   * 単体テストプロンプトを構築
   */
  private buildUnitTestPrompt(task: Task, codeChanges: CodeChange[]): string {
    const changedFiles = codeChanges
      .filter(change => change.action !== 'DELETE')
      .map(change => change.filePath)
      .join('\n');

    return `
以下のタスクで実装されたコードに対して、包括的な単体テストを作成・実行してください。

## タスク情報
- タイトル: ${task.title}
- 説明: ${task.description}

## 変更されたファイル
${changedFiles}

## テスト要件
1. 各関数/クラスに対して単体テストを作成
2. 正常系と異常系の両方をテスト
3. エッジケースを考慮
4. テストカバレッジを高める
5. 意味のあるテストケースを作成

## 実行手順
1. 適切なテストフレームワークを使用（Jest、Mocha、pytest等）
2. テストファイルを作成
3. テストを実行
4. 結果を収集

## 出力形式
以下のJSON形式で結果を返してください：

\`\`\`json
{
  "testsCreated": 10,
  "testsExecuted": 10,
  "testsPassed": 9,
  "testsFailed": 1,
  "executionTime": 3500,
  "testDetails": [
    {
      "name": "should calculate sum correctly",
      "passed": true,
      "duration": 15,
      "file": "src/calculator.test.ts"
    },
    {
      "name": "should handle null input",
      "passed": false,
      "duration": 8,
      "error": "Expected null to throw error",
      "file": "src/calculator.test.ts"
    }
  ],
  "coverage": 85.5
}
\`\`\`

高品質で保守しやすいテストコードを作成してください。
`;
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    // Claude Executorのイベント
    this.claudeExecutor.on('log', ({ level, message }) => {
      this.emit('executor-log', { level, message });
    });

    // タスクキューのイベント
    this.taskQueue.on('job:assigned', (job) => {
      this.emit('task-assigned', job);
    });
  }

  /**
   * 初期化状態を確認
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Subordinate Controller is not initialized. Call initialize() first.');
    }
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [SubordinateController-${this.config.agentId}] ${message}`);
  }
}
/**
 * Boss AI Controller V2
 * ClaudeCommandExecutorを使用した新しい実装
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeCommandExecutor } from '../claude/command-executor';
import { TaskQueue } from '../queue/task-queue';
import { Task, WorkResult, TestResult, LogLevel, TaskStatus, TestType } from '../models/types';
import { validateTask, validateWorkResult } from '../models/validation';
import { join } from 'path';

export interface BossControllerConfig {
  workspacePath: string;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  reviewTimeout?: number;
  integrationTestTimeout?: number;
  mcpServers?: Record<string, { command: string; args: string[] }>;
}

export interface UserInstruction {
  id: string;
  content: string;
  priority: number;
  timestamp: Date;
  userId?: string;
  projectId?: string;
}

export interface TaskDecompositionResult {
  tasks: Task[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface ReviewResult {
  approved: boolean;
  feedback: string;
  suggestions: string[];
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    file?: string;
    line?: number;
  }>;
  score: number; // 0-100
}

export interface IntegrationTestResult extends TestResult {
  coverage: number;
  performanceMetrics?: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  browserTestResults?: {
    passed: boolean;
    screenshots: string[];
    errors: string[];
  };
}

export class BossControllerV2 extends EventEmitter {
  private claudeExecutor: ClaudeCommandExecutor;
  private taskQueue: TaskQueue;
  private config: Required<BossControllerConfig>;
  private isInitialized: boolean = false;
  private activeInstructions: Map<string, UserInstruction> = new Map();
  private taskHistory: Map<string, Task[]> = new Map();
  private reviewHistory: Map<string, ReviewResult> = new Map();
  private mcpConfigPath?: string;

  constructor(config: BossControllerConfig) {
    super();
    
    this.config = {
      workspacePath: config.workspacePath,
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      taskTimeout: config.taskTimeout || 300000, // 5分
      reviewTimeout: config.reviewTimeout || 120000, // 2分
      integrationTestTimeout: config.integrationTestTimeout || 600000, // 10分
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
   * Boss Controllerを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log(LogLevel.INFO, 'Initializing Boss Controller V2');

      // Claude Code CLIの利用可能性確認
      const available = await this.claudeExecutor.checkAvailability();
      if (!available) {
        throw new Error('Claude Code CLI is not available');
      }

      // MCPサーバー設定をセットアップ
      if (this.config.mcpServers && Object.keys(this.config.mcpServers).length > 0) {
        this.mcpConfigPath = await this.claudeExecutor.createMcpConfig(
          this.config.mcpServers,
          join(this.config.workspacePath, '.mcp-config.json')
        );
      }

      // ワークスペースのセットアップ
      await this.claudeExecutor.setupWorkspace(this.config.workspacePath);
      
      // タスクキューを初期化
      await this.taskQueue.initialize();

      // 初期化完了の確認
      await this.verifyInitialization();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.log(LogLevel.INFO, 'Boss Controller V2 initialized successfully');
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to initialize Boss Controller: ${error}`);
      throw error;
    }
  }

  /**
   * ユーザー指示を処理してタスクに分解
   */
  async processUserInstruction(instruction: UserInstruction): Promise<TaskDecompositionResult> {
    this.ensureInitialized();
    
    try {
      this.log(LogLevel.INFO, `Processing user instruction: ${instruction.id}`);
      
      // 指示を記録
      this.activeInstructions.set(instruction.id, instruction);
      
      // タスク分解プロンプトを構築して送信
      const prompt = this.buildTaskDecompositionPrompt(instruction);
      
      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        tasks: Array<{
          title: string;
          description: string;
          priority: number;
          estimatedDuration: number;
          dependencies: string[];
          requiredSkills: string[];
          acceptanceCriteria: string[];
        }>;
        dependencies: Record<string, string[]>;
        estimatedDuration: number;
        complexity: 'low' | 'medium' | 'high';
      }>(prompt, {
        timeout: this.config.taskTimeout,
        ...(this.mcpConfigPath && { mcpConfig: this.mcpConfigPath }),
        appendSystemPrompt: 'You are an experienced project manager who excels at breaking down complex requirements into manageable tasks.'
      });

      // レスポンスをTaskオブジェクトに変換
      const tasks: Task[] = response.tasks.map((taskData) => {
        const task: Task = {
          id: uuidv4(),
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          dependencies: taskData.dependencies
        };

        // バリデーション
        return validateTask(task);
      });

      // 依存関係マップを構築
      const dependencies = new Map<string, string[]>();
      tasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
          dependencies.set(task.id, task.dependencies);
        }
      });

      const result: TaskDecompositionResult = {
        tasks,
        dependencies,
        estimatedDuration: response.estimatedDuration,
        complexity: response.complexity
      };

      // タスク履歴に記録
      this.taskHistory.set(instruction.id, tasks);

      this.log(LogLevel.INFO, `Created ${tasks.length} tasks from instruction ${instruction.id}`);
      this.emit('tasks-created', instruction.id, result);

      return result;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to process user instruction ${instruction.id}: ${error}`);
      throw error;
    }
  }

  /**
   * 部下AIからの成果物をレビュー
   */
  async reviewSubordinateWork(workResult: WorkResult): Promise<ReviewResult> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Reviewing work result for task: ${workResult.taskId}`);

      // バリデーション
      const validatedResult = validateWorkResult(workResult);

      // レビュープロンプトを構築
      const prompt = this.buildCodeReviewPrompt(validatedResult);
      
      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        approved: boolean;
        feedback: string;
        suggestions: string[];
        issues: Array<{
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          file?: string;
          line?: number;
        }>;
        score: number;
        codeQuality: {
          readability: number;
          maintainability: number;
          testCoverage: number;
          performance: number;
        };
        recommendations: string[];
      }>(prompt, {
        timeout: this.config.reviewTimeout,
        ...(this.mcpConfigPath && { mcpConfig: this.mcpConfigPath }),
        appendSystemPrompt: 'You are a senior engineer performing thorough code reviews with a focus on quality, security, and best practices.'
      });

      const reviewResult: ReviewResult = {
        approved: response.approved,
        feedback: response.feedback,
        suggestions: response.suggestions,
        issues: response.issues,
        score: response.score
      };

      // レビュー履歴に記録
      this.reviewHistory.set(workResult.taskId, reviewResult);

      this.log(LogLevel.INFO, `Review completed for task ${workResult.taskId}: ${response.approved ? 'APPROVED' : 'REJECTED'} (Score: ${response.score})`);
      this.emit('work-reviewed', workResult.taskId, reviewResult);

      return reviewResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to review work result for task ${workResult.taskId}: ${error}`);
      throw error;
    }
  }

  /**
   * 結合テストを実行
   */
  async runIntegrationTests(projectPath: string, testType: 'backend' | 'frontend' | 'full'): Promise<IntegrationTestResult> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Running ${testType} integration tests for project: ${projectPath}`);

      // 結合テストプロンプトを構築
      const prompt = this.buildIntegrationTestPrompt(projectPath, testType);
      
      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        testResults: {
          passed: boolean;
          totalTests: number;
          passedTests: number;
          failedTests: number;
          executionTime: number;
          details: Array<{
            testName: string;
            status: 'passed' | 'failed' | 'skipped';
            duration: number;
            error?: string;
          }>;
        };
        coverage: number;
        performanceMetrics?: {
          executionTime: number;
          memoryUsage: number;
          cpuUsage: number;
        };
        browserTestResults?: {
          passed: boolean;
          screenshots: string[];
          errors: string[];
        };
      }>(prompt, {
        timeout: this.config.integrationTestTimeout,
        ...(this.mcpConfigPath && { mcpConfig: this.mcpConfigPath }),
        workspacePath: projectPath,
        allowedTools: ['Bash', 'Edit', 'mcp__filesystem__read_file', 'mcp__filesystem__list_directory']
      });

      const integrationTestResult: IntegrationTestResult = {
        testType: TestType.INTEGRATION,
        passed: response.testResults.passed,
        totalTests: response.testResults.totalTests,
        passedTests: response.testResults.passedTests,
        failedTests: response.testResults.failedTests,
        executionTime: response.testResults.executionTime,
        details: response.testResults.details.map(detail => ({
          name: detail.testName,
          passed: detail.status === 'passed',
          duration: detail.duration,
          error: detail.error || ''
        })),
        coverage: response.coverage,
        ...(response.performanceMetrics && { performanceMetrics: response.performanceMetrics }),
        ...(response.browserTestResults && { browserTestResults: response.browserTestResults })
      };

      this.log(LogLevel.INFO, `Integration tests completed: ${response.testResults.passed ? 'PASSED' : 'FAILED'} (${response.testResults.passedTests}/${response.testResults.totalTests})`);
      this.emit('integration-tests-completed', projectPath, integrationTestResult);

      return integrationTestResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to run integration tests for project ${projectPath}: ${error}`);
      throw error;
    }
  }

  /**
   * 作成されたタスクをTask Queueに追加
   */
  async addTasksToQueue(tasks: Task[]): Promise<string[]> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Adding ${tasks.length} tasks to queue`);

      const jobIds: string[] = [];
      
      for (const task of tasks) {
        const jobId = await this.taskQueue.addTask(task, {
          priority: this.mapTaskPriorityToJobPriority(task.priority),
          delay: this.calculateTaskDelay(task),
          attempts: 3
        });
        
        jobIds.push(jobId);
        this.log(LogLevel.DEBUG, `Task ${task.id} added to queue with job ID: ${jobId}`);
      }

      this.emit('tasks-queued', tasks, jobIds);
      this.log(LogLevel.INFO, `Successfully added ${tasks.length} tasks to queue`);

      return jobIds;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to add tasks to queue: ${error}`);
      throw error;
    }
  }

  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      executorStats: this.claudeExecutor.getStats(),
      queueStatus: this.taskQueue.getStats(),
      activeInstructions: this.activeInstructions.size,
      taskHistory: this.taskHistory.size,
      reviewHistory: this.reviewHistory.size,
      config: this.config
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      this.log(LogLevel.INFO, 'Cleaning up Boss Controller V2');

      // Claude Executorのクリーンアップ
      await this.claudeExecutor.cleanup();
      
      // タスクキューのクリーンアップ
      await this.taskQueue.close();

      // イベントリスナーの削除
      this.removeAllListeners();

      this.isInitialized = false;
      this.log(LogLevel.INFO, 'Boss Controller V2 cleanup completed');
      
    } catch (error) {
      this.log(LogLevel.ERROR, `Error during Boss Controller cleanup: ${error}`);
      throw error;
    }
  }

  /**
   * タスク分解プロンプトを構築
   */
  private buildTaskDecompositionPrompt(instruction: UserInstruction): string {
    return `
以下のユーザー指示を分析し、具体的で実行可能なタスクに分解してください。

## ユーザー指示
${instruction.content}

## 要求事項
1. 各タスクは独立して実行可能である必要があります
2. タスクの依存関係を明確に定義してください
3. 各タスクに適切な優先度を設定してください（1-10、10が最高優先度）
4. 各タスクの推定実行時間を分単位で設定してください
5. 必要なスキルセットを明記してください
6. 受け入れ基準を明確に定義してください

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "tasks": [
    {
      "title": "タスクのタイトル",
      "description": "詳細な説明",
      "priority": 5,
      "estimatedDuration": 120,
      "dependencies": ["依存するタスクのタイトル"],
      "requiredSkills": ["TypeScript", "React"],
      "acceptanceCriteria": [
        "基準1",
        "基準2"
      ]
    }
  ],
  "dependencies": {
    "タスクタイトル": ["依存タスク1", "依存タスク2"]
  },
  "estimatedDuration": 480,
  "complexity": "medium"
}
\`\`\`

プロジェクトの成功のために、実用的で実行可能なタスク分解を行ってください。
`;
  }

  /**
   * コードレビュープロンプトを構築
   */
  private buildCodeReviewPrompt(workResult: WorkResult): string {
    const codeChangesJson = JSON.stringify(workResult.codeChanges, null, 2);
    const testResultsJson = JSON.stringify(workResult.testResults, null, 2);

    return `
以下のコード変更をレビューし、品質評価を行ってください。

## タスクID
${workResult.taskId}

## エージェントID
${workResult.agentId}

## コード変更
${codeChangesJson}

## テスト結果
${testResultsJson}

## レビュー観点
1. コードの可読性と保守性
2. セキュリティの観点
3. パフォーマンスの観点
4. テストカバレッジの適切性
5. ベストプラクティスの遵守
6. エラーハンドリングの適切性

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "approved": true,
  "feedback": "全体的な評価コメント",
  "suggestions": [
    "改善提案1",
    "改善提案2"
  ],
  "issues": [
    {
      "severity": "medium",
      "description": "問題の説明",
      "file": "src/example.ts",
      "line": 42
    }
  ],
  "score": 85,
  "codeQuality": {
    "readability": 90,
    "maintainability": 85,
    "testCoverage": 80,
    "performance": 90
  },
  "recommendations": [
    "推奨事項1",
    "推奨事項2"
  ]
}
\`\`\`

建設的で具体的なフィードバックを提供してください。
`;
  }

  /**
   * 結合テストプロンプトを構築
   */
  private buildIntegrationTestPrompt(projectPath: string, testType: 'backend' | 'frontend' | 'full'): string {
    return `
以下のプロジェクトの結合テストを実行してください。

## プロジェクトパス
${projectPath}

## テストタイプ
${testType}

## 実行内容
1. プロジェクトの構造を分析
2. 適切な結合テストを実行
3. テストカバレッジを測定
4. パフォーマンス指標を収集
5. 問題があれば詳細を報告

必要に応じてMCPファイルシステムツールを使用してファイルを読み取り、Bashツールでテストコマンドを実行してください。

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "testResults": {
    "passed": true,
    "totalTests": 25,
    "passedTests": 23,
    "failedTests": 2,
    "executionTime": 45000,
    "details": [
      {
        "testName": "API Integration Test",
        "status": "passed",
        "duration": 1200,
        "error": null
      }
    ]
  },
  "coverage": 85.5,
  "performanceMetrics": {
    "executionTime": 45000,
    "memoryUsage": 256,
    "cpuUsage": 45
  }
}
\`\`\`

包括的で信頼性の高いテスト結果を提供してください。
`;
  }

  /**
   * 初期化の検証
   */
  private async verifyInitialization(): Promise<void> {
    // Claude Code CLIの動作確認
    const testResponse = await this.claudeExecutor.sendPrompt(
      'Hello, Claude. Please respond with "Boss Controller initialized successfully" to confirm you are ready.',
      { timeout: 10000 }
    );

    if (!testResponse.includes('Boss Controller initialized successfully')) {
      throw new Error('Claude Code CLI initialization verification failed');
    }

    // タスクキューの動作確認
    const queueStats = await this.taskQueue.getStats();
    if (typeof queueStats.waiting !== 'number') {
      throw new Error('Task queue initialization verification failed');
    }
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
    this.taskQueue.on('job:completed', (job, result) => {
      this.emit('task-completed', job, result);
    });

    this.taskQueue.on('job:failed', (job, error) => {
      this.emit('task-failed', job, error);
    });
  }

  /**
   * 初期化状態を確認
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Boss Controller is not initialized. Call initialize() first.');
    }
  }

  /**
   * タスクの優先度をジョブ優先度にマッピング
   */
  private mapTaskPriorityToJobPriority(taskPriority: number): number {
    if (taskPriority >= 9) return 1;   // 最高優先度
    if (taskPriority >= 7) return 2;   // 高優先度
    if (taskPriority >= 5) return 3;   // 中優先度
    if (taskPriority >= 3) return 4;   // 低優先度
    return 5;                          // 最低優先度
  }

  /**
   * タスクの遅延時間を計算
   */
  private calculateTaskDelay(task: Task): number {
    // 依存関係がある場合は遅延を設定
    if (task.dependencies && task.dependencies.length > 0) {
      return 5000; // 5秒の遅延
    }
    return 0;
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [BossControllerV2] ${message}`);
  }
}
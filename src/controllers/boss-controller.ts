/**
 * Boss AI Controller
 * ユーザー指示の処理、タスク分解、部下AIへの割り振り、コードレビューを担当
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeProcessManager, ClaudeCommunicationInterface } from '../claude';
import { TaskQueue } from '../queue/task-queue';
import { Task, WorkResult, TestResult, LogLevel, TaskStatus, TestType } from '../models/types';
import { validateTask, validateWorkResult } from '../models/validation';

export interface BossControllerConfig {
  workspacePath: string;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  reviewTimeout?: number;
  integrationTestTimeout?: number;
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

export class BossController extends EventEmitter {
  private processManager: ClaudeProcessManager;
  private communicationInterface: ClaudeCommunicationInterface;
  private taskQueue: TaskQueue;
  private config: Required<BossControllerConfig>;
  private isInitialized: boolean = false;
  private activeInstructions: Map<string, UserInstruction> = new Map();
  private taskHistory: Map<string, Task[]> = new Map();
  private reviewHistory: Map<string, ReviewResult> = new Map();

  constructor(config: BossControllerConfig) {
    super();
    
    this.config = {
      workspacePath: config.workspacePath,
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      taskTimeout: config.taskTimeout || 300000, // 5分
      reviewTimeout: config.reviewTimeout || 120000, // 2分
      integrationTestTimeout: config.integrationTestTimeout || 600000 // 10分
    };

    // Claude Code CLI関連の初期化
    this.processManager = new ClaudeProcessManager({
      workspacePath: this.config.workspacePath,
      permissionMode: 'bypassPermissions',
      printOutput: true,
      timeout: this.config.taskTimeout,
      maxRetries: 3,
      restartDelay: 5000
    });

    this.communicationInterface = new ClaudeCommunicationInterface(this.processManager, {
      defaultTimeout: this.config.taskTimeout,
      maxConcurrentCommands: this.config.maxConcurrentTasks,
      retryAttempts: 2,
      retryDelay: 1000
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
      this.log(LogLevel.INFO, 'Initializing Boss Controller');

      // Claude Code CLIプロセスを起動
      await this.processManager.start();
      
      // タスクキューを初期化
      await this.taskQueue.initialize();

      // 初期化完了の確認
      await this.verifyInitialization();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.log(LogLevel.INFO, 'Boss Controller initialized successfully');
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
      
      // Claude Code CLIに指示を送信してタスクに分解
      const decompositionPrompt = this.buildTaskDecompositionPrompt(instruction);
      
      const response = await this.communicationInterface.sendPromptExpectJSON<{
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
      }>(decompositionPrompt, {
        timeout: this.config.taskTimeout,
        retryOnError: true
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
          dependencies: taskData.dependencies,
          // estimatedDuration: taskData.estimatedDuration, // Taskインターフェースにない場合はコメントアウト
          // requiredSkills: taskData.requiredSkills, // Taskインターフェースにない場合はコメントアウト
          // acceptanceCriteria: taskData.acceptanceCriteria, // Taskインターフェースにない場合はコメントアウト
          // projectId: instruction.projectId, // Taskインターフェースにない場合はコメントアウト
          // createdBy: 'boss-ai', // Taskインターフェースにない場合はコメントアウト
          // metadata: {
          //   instructionId: instruction.id,
          //   orderIndex: index,
          //   complexity: response.complexity
          // } // Taskインターフェースにない場合はコメントアウト
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
   * タスクの優先度と依存関係を設定
   */
  async setTaskPriorityAndDependencies(
    tasks: Task[], 
    dependencies: Map<string, string[]>
  ): Promise<Task[]> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Setting priorities and dependencies for ${tasks.length} tasks`);

      // 依存関係の解析プロンプトを構築
      const analysisPrompt = this.buildDependencyAnalysisPrompt(tasks, dependencies);
      
      const response = await this.communicationInterface.sendPromptExpectJSON<{
        optimizedTasks: Array<{
          id: string;
          priority: number;
          dependencies: string[];
          executionOrder: number;
          reasoning: string;
        }>;
        criticalPath: string[];
        parallelGroups: string[][];
      }>(analysisPrompt, {
        timeout: this.config.taskTimeout,
        retryOnError: true
      });

      // タスクの優先度と依存関係を更新
      const updatedTasks = tasks.map(task => {
        const optimization = response.optimizedTasks.find(opt => opt.id === task.id);
        if (optimization) {
          return {
            ...task,
            priority: optimization.priority,
            dependencies: optimization.dependencies,
            metadata: {
              ...(task as any).metadata,
              executionOrder: optimization.executionOrder,
              reasoning: optimization.reasoning,
              criticalPath: response.criticalPath.includes(task.id),
              parallelGroup: response.parallelGroups.findIndex(group => group.includes(task.id))
            }
          };
        }
        return task;
      });

      // 実行順序でソート
      updatedTasks.sort((a, b) => {
        const orderA = (a as any).metadata?.executionOrder || 0;
        const orderB = (b as any).metadata?.executionOrder || 0;
        return orderA - orderB;
      });

      this.log(LogLevel.INFO, `Optimized task priorities and dependencies`);
      this.emit('tasks-optimized', updatedTasks);

      return updatedTasks;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to set task priorities and dependencies: ${error}`);
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
      const reviewPrompt = this.buildCodeReviewPrompt(validatedResult);
      
      const response = await this.communicationInterface.sendPromptExpectJSON<{
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
      }>(reviewPrompt, {
        timeout: this.config.reviewTimeout,
        retryOnError: true
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
      const testPrompt = this.buildIntegrationTestPrompt(projectPath, testType);
      
      const response = await this.communicationInterface.sendPromptExpectJSON<{
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
      }>(testPrompt, {
        timeout: this.config.integrationTestTimeout,
        retryOnError: true
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
   * 部下AIの状況を監視し適切にタスクを分散
   */
  async distributeTasksToSubordinates(): Promise<void> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, 'Starting task distribution to subordinates');

      // 利用可能な部下AIを取得
      const availableSubordinates = await this.getAvailableSubordinates();
      
      if (availableSubordinates.length === 0) {
        this.log(LogLevel.WARN, 'No available subordinates found for task distribution');
        return;
      }

      // キューから待機中のタスクを取得
      const queueStats = await this.taskQueue.getStats();
      
      if (queueStats.waiting === 0) {
        this.log(LogLevel.DEBUG, 'No waiting tasks in queue');
        return;
      }

      // 各部下AIに適切なタスクを割り当て
      for (const subordinate of availableSubordinates) {
        const suitableTask = await this.findSuitableTaskForSubordinate(subordinate.id);
        
        if (suitableTask) {
          await this.assignTaskToSubordinate(suitableTask, subordinate.id);
          this.log(LogLevel.INFO, `Task ${suitableTask.id} assigned to subordinate ${subordinate.id}`);
        }
      }

      this.emit('tasks-distributed', availableSubordinates.length);

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to distribute tasks to subordinates: ${error}`);
      throw error;
    }
  }

  /**
   * タスクの依存関係を考慮した実行順序制御
   */
  async enforceTaskDependencies(tasks: Task[]): Promise<Task[]> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Enforcing dependencies for ${tasks.length} tasks`);

      // 依存関係グラフを構築
      const dependencyGraph = this.buildDependencyGraph(tasks);
      
      // トポロジカルソートで実行順序を決定
      const sortedTasks = this.topologicalSort(tasks, dependencyGraph);
      
      // 依存関係に基づいて遅延を設定
      const tasksWithDelays = this.calculateDependencyDelays(sortedTasks, dependencyGraph);

      this.log(LogLevel.INFO, `Task execution order determined with dependency constraints`);
      this.emit('dependencies-enforced', tasksWithDelays);

      return tasksWithDelays;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to enforce task dependencies: ${error}`);
      throw error;
    }
  }

  /**
   * 部下AIの負荷分散を監視・調整
   */
  async monitorAndBalanceLoad(): Promise<void> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.DEBUG, 'Monitoring subordinate load balance');

      const subordinates = await this.getAllSubordinates();
      const loadMetrics = await this.calculateLoadMetrics(subordinates);

      // 負荷が不均衡な場合は再分散
      if (this.isLoadImbalanced(loadMetrics)) {
        this.log(LogLevel.WARN, 'Load imbalance detected, redistributing tasks');
        await this.rebalanceTasks(subordinates, loadMetrics);
      }

      // パフォーマンス指標を更新
      this.updatePerformanceMetrics(loadMetrics);

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to monitor and balance load: ${error}`);
      throw error;
    }
  }

  /**
   * フロントエンドのブラウザテストを実行（MCP経由）
   */
  async runBrowserTests(projectPath: string, testScenarios: string[]): Promise<IntegrationTestResult> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Running browser tests for project: ${projectPath}`);

      // ブラウザテストプロンプトを構築（MCP使用）
      const browserTestPrompt = this.buildBrowserTestPrompt(projectPath, testScenarios);
      
      const response = await this.communicationInterface.sendPromptExpectJSON<{
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
            screenshot?: string;
          }>;
        };
        browserTestResults: {
          passed: boolean;
          screenshots: string[];
          errors: string[];
          performanceMetrics: {
            loadTime: number;
            renderTime: number;
            interactionTime: number;
          };
        };
      }>(browserTestPrompt, {
        timeout: this.config.integrationTestTimeout,
        retryOnError: true
      });

      const browserTestResult: IntegrationTestResult = {
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
        coverage: 0, // ブラウザテストではカバレッジは計算しない
        ...(response.browserTestResults && { browserTestResults: response.browserTestResults })
      };

      this.log(LogLevel.INFO, `Browser tests completed: ${response.testResults.passed ? 'PASSED' : 'FAILED'} (${response.testResults.passedTests}/${response.testResults.totalTests})`);
      this.emit('browser-tests-completed', projectPath, browserTestResult);

      return browserTestResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to run browser tests for project ${projectPath}: ${error}`);
      throw error;
    }
  }

  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      processStatus: this.processManager.getProcessInfo(),
      communicationStatus: this.communicationInterface.getStatus(),
      queueStatus: this.taskQueue.getStats(),
      activeInstructions: this.activeInstructions.size,
      taskHistory: this.taskHistory.size,
      reviewHistory: this.reviewHistory.size,
      config: this.config
    };
  }

  /**
   * 詳細な統計情報を取得
   */
  async getDetailedStats() {
    const status = this.getStatus();
    const communicationStats = this.communicationInterface.getDetailedStats();
    const queueStats = await this.taskQueue.getStats();
    
    return {
      status,
      communication: communicationStats,
      queue: queueStats,
      performance: {
        averageTaskDecompositionTime: 0, // 実装時に計算
        averageReviewTime: 0, // 実装時に計算
        averageIntegrationTestTime: 0, // 実装時に計算
        successRate: 0 // 実装時に計算
      }
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      this.log(LogLevel.INFO, 'Cleaning up Boss Controller');

      // 通信インターフェースのクリーンアップ
      await this.communicationInterface.cleanup();
      
      // プロセスマネージャーのクリーンアップ
      await this.processManager.cleanup();
      
      // タスクキューのクリーンアップ
      await this.taskQueue.close();

      // イベントリスナーの削除
      this.removeAllListeners();

      this.isInitialized = false;
      this.log(LogLevel.INFO, 'Boss Controller cleanup completed');
      
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
あなたは経験豊富なプロジェクトマネージャーです。以下のユーザー指示を分析し、具体的で実行可能なタスクに分解してください。

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
   * 依存関係解析プロンプトを構築
   */
  private buildDependencyAnalysisPrompt(tasks: Task[], dependencies: Map<string, string[]>): string {
    const tasksJson = JSON.stringify(tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependencies: t.dependencies,
      // estimatedDuration: t.estimatedDuration // Taskインターフェースにない場合はコメントアウト
    })), null, 2);

    const dependenciesJson = JSON.stringify(Object.fromEntries(dependencies), null, 2);

    return `
あなたは経験豊富なプロジェクトマネージャーです。以下のタスクリストを分析し、最適な実行順序と優先度を決定してください。

## タスクリスト
${tasksJson}

## 現在の依存関係
${dependenciesJson}

## 要求事項
1. 依存関係を考慮した最適な実行順序を決定
2. 並行実行可能なタスクグループを特定
3. クリティカルパスを特定
4. 各タスクの優先度を最適化（1-10）
5. 実行順序の理由を説明

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "optimizedTasks": [
    {
      "id": "task-id",
      "priority": 8,
      "dependencies": ["dependency-id"],
      "executionOrder": 1,
      "reasoning": "このタスクを最初に実行する理由"
    }
  ],
  "criticalPath": ["task-id-1", "task-id-2"],
  "parallelGroups": [
    ["task-id-3", "task-id-4"],
    ["task-id-5", "task-id-6"]
  ]
}
\`\`\`

プロジェクトの効率的な実行のために、最適化された計画を提供してください。
`;
  }

  /**
   * コードレビュープロンプトを構築
   */
  private buildCodeReviewPrompt(workResult: WorkResult): string {
    const codeChangesJson = JSON.stringify(workResult.codeChanges, null, 2);
    const testResultsJson = JSON.stringify(workResult.testResults, null, 2);

    return `
あなたは経験豊富なシニアエンジニアです。以下のコード変更をレビューし、品質評価を行ってください。

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
あなたは経験豊富なQAエンジニアです。以下のプロジェクトの結合テストを実行してください。

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
   * ブラウザテストプロンプトを構築（MCP使用）
   */
  private buildBrowserTestPrompt(projectPath: string, testScenarios: string[]): string {
    const scenariosJson = JSON.stringify(testScenarios, null, 2);

    return `
あなたは経験豊富なE2Eテストエンジニアです。MCPのブラウザツールを使用して、以下のプロジェクトのブラウザテストを実行してください。

## プロジェクトパス
${projectPath}

## テストシナリオ
${scenariosJson}

## 実行内容
1. ブラウザを起動してアプリケーションにアクセス
2. 各テストシナリオを実行
3. スクリーンショットを撮影
4. パフォーマンス指標を測定
5. エラーがあれば詳細を記録

## MCPツール使用例
\`\`\`
// ブラウザを起動
browser.launch()

// ページにアクセス
browser.navigate("http://localhost:3000")

// スクリーンショットを撮影
browser.screenshot("test-result.png")

// 要素をクリック
browser.click("#submit-button")

// フォームに入力
browser.type("#username", "testuser")
\`\`\`

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "testResults": {
    "passed": true,
    "totalTests": 10,
    "passedTests": 9,
    "failedTests": 1,
    "executionTime": 30000,
    "details": [
      {
        "testName": "Login Flow Test",
        "status": "passed",
        "duration": 3000,
        "error": null,
        "screenshot": "login-test.png"
      }
    ]
  },
  "browserTestResults": {
    "passed": true,
    "screenshots": ["test1.png", "test2.png"],
    "errors": [],
    "performanceMetrics": {
      "loadTime": 1200,
      "renderTime": 800,
      "interactionTime": 150
    }
  }
}
\`\`\`

実際のユーザー体験を重視した包括的なテストを実行してください。
`;
  }

  /**
   * 初期化の検証
   */
  private async verifyInitialization(): Promise<void> {
    // Claude Code CLIの動作確認
    const testResponse = await this.communicationInterface.sendPrompt(
      'Hello, Claude. Please respond with "Boss Controller initialized successfully" to confirm you are ready.',
      { timeout: 10000 }
    );

    if (!testResponse.success) {
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
    // プロセスマネージャーのイベント
    this.processManager.on('status-change', (status) => {
      this.emit('process-status-change', status);
    });

    this.processManager.on('error', (error) => {
      this.emit('process-error', error);
    });

    // 通信インターフェースのイベント
    this.communicationInterface.on('response', (response) => {
      this.emit('claude-response', response);
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
   * 利用可能な部下AIを取得
   */
  private async getAvailableSubordinates(): Promise<Array<{ id: string; status: string; currentLoad: number }>> {
    // 実際の実装では、部下AIの状態を監視するサービスから情報を取得
    // ここではモックデータを返す
    return [
      { id: 'subordinate-1', status: 'idle', currentLoad: 0 },
      { id: 'subordinate-2', status: 'idle', currentLoad: 1 },
      { id: 'subordinate-3', status: 'working', currentLoad: 2 }
    ].filter(sub => sub.status === 'idle' || sub.currentLoad < 3);
  }

  /**
   * 部下AIに適したタスクを検索
   */
  private async findSuitableTaskForSubordinate(subordinateId: string): Promise<Task | null> {
    try {
      // タスクキューから次のタスクを取得
      const task = await this.taskQueue.getNextTask(subordinateId);
      return task;
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to find suitable task for ${subordinateId}: ${error}`);
      return null;
    }
  }

  /**
   * タスクを部下AIに割り当て
   */
  private async assignTaskToSubordinate(task: Task, subordinateId: string): Promise<void> {
    try {
      // タスクの割り当て情報を更新
      const updatedTask = {
        ...task,
        assignedTo: subordinateId,
        status: TaskStatus.IN_PROGRESS
      };

      // 実際の実装では、部下AIにタスクを送信する処理を追加
      this.emit('task-assigned', updatedTask, subordinateId);
      
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to assign task ${task.id} to ${subordinateId}: ${error}`);
      throw error;
    }
  }

  /**
   * 依存関係グラフを構築
   */
  private buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const task of tasks) {
      if (task.dependencies && task.dependencies.length > 0) {
        graph.set(task.id, task.dependencies);
      } else {
        graph.set(task.id, []);
      }
    }
    
    return graph;
  }

  /**
   * トポロジカルソート
   */
  private topologicalSort(tasks: Task[], dependencyGraph: Map<string, string[]>): Task[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: Task[] = [];
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    const visit = (taskId: string): void => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      
      if (visited.has(taskId)) {
        return;
      }

      visiting.add(taskId);
      
      const dependencies = dependencyGraph.get(taskId) || [];
      for (const depId of dependencies) {
        visit(depId);
      }
      
      visiting.delete(taskId);
      visited.add(taskId);
      
      const task = taskMap.get(taskId);
      if (task) {
        result.push(task); // 依存関係の順序で追加（pushに変更）
      }
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    }

    return result;
  }

  /**
   * 依存関係に基づく遅延を計算
   */
  private calculateDependencyDelays(tasks: Task[], dependencyGraph: Map<string, string[]>): Task[] {
    const taskDelays = new Map<string, number>();
    
    // 各タスクの遅延時間を計算
    for (const task of tasks) {
      const dependencies = dependencyGraph.get(task.id) || [];
      let maxDelay = 0;
      
      for (const depId of dependencies) {
        const depDelay = taskDelays.get(depId) || 0;
        maxDelay = Math.max(maxDelay, depDelay + 1000); // 1秒の基本遅延
      }
      
      taskDelays.set(task.id, maxDelay);
    }

    // タスクに遅延情報を追加
    return tasks.map(task => ({
      ...task,
      delay: taskDelays.get(task.id) || 0
    } as any));
  }

  /**
   * すべての部下AIを取得
   */
  private async getAllSubordinates(): Promise<Array<{ id: string; status: string; currentLoad: number; performance: any }>> {
    // 実際の実装では、部下AI管理サービスから情報を取得
    return [
      { id: 'subordinate-1', status: 'idle', currentLoad: 0, performance: { tasksCompleted: 10, averageTime: 120 } },
      { id: 'subordinate-2', status: 'working', currentLoad: 2, performance: { tasksCompleted: 8, averageTime: 150 } },
      { id: 'subordinate-3', status: 'working', currentLoad: 1, performance: { tasksCompleted: 12, averageTime: 100 } }
    ];
  }

  /**
   * 負荷メトリクスを計算
   */
  private async calculateLoadMetrics(subordinates: Array<{ id: string; currentLoad: number; performance: any }>): Promise<any> {
    const totalLoad = subordinates.reduce((sum, sub) => sum + sub.currentLoad, 0);
    const averageLoad = totalLoad / subordinates.length;
    
    return {
      totalLoad,
      averageLoad,
      maxLoad: Math.max(...subordinates.map(sub => sub.currentLoad)),
      minLoad: Math.min(...subordinates.map(sub => sub.currentLoad)),
      subordinates: subordinates.map(sub => ({
        ...sub,
        loadRatio: sub.currentLoad / averageLoad
      }))
    };
  }

  /**
   * 負荷が不均衡かどうかを判定
   */
  private isLoadImbalanced(loadMetrics: any): boolean {
    const threshold = 1.5; // 50%以上の差があれば不均衡とみなす
    return loadMetrics.maxLoad / (loadMetrics.minLoad + 1) > threshold;
  }

  /**
   * タスクの再分散
   */
  private async rebalanceTasks(subordinates: any[], loadMetrics: any): Promise<void> {
    // 高負荷の部下AIから低負荷の部下AIにタスクを移動
    const overloadedSubs = subordinates.filter(sub => sub.currentLoad > loadMetrics.averageLoad * 1.2);
    const underloadedSubs = subordinates.filter(sub => sub.currentLoad < loadMetrics.averageLoad * 0.8);

    for (const overloaded of overloadedSubs) {
      for (const underloaded of underloadedSubs) {
        if (overloaded.currentLoad > underloaded.currentLoad + 1) {
          // タスクの移動ロジック（実際の実装では具体的な移動処理を行う）
          this.log(LogLevel.INFO, `Rebalancing: moving task from ${overloaded.id} to ${underloaded.id}`);
          break;
        }
      }
    }
  }

  /**
   * パフォーマンス指標を更新
   */
  private updatePerformanceMetrics(loadMetrics: any): void {
    // パフォーマンス指標の更新（実際の実装では永続化も行う）
    this.emit('performance-metrics-updated', loadMetrics);
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [BossController] ${message}`);
  }
}
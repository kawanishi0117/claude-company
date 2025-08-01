/**
 * System Integration Tests
 * 全体システムの統合テスト
 */

import { BossControllerV2 } from '../../controllers/boss-controller-v2';
import { SubordinateController } from '../../controllers/subordinate-controller';
import { GitManager } from '../../git/git-manager';
import { TaskQueue } from '../../queue/task-queue';
import { Task, TaskStatus } from '../../models/types';
import { ClaudeCommandExecutor } from '../../claude/command-executor';

// 実際のClaude Code CLIが必要な統合テスト
describe('System Integration Tests', () => {
  const testWorkspace = '/tmp/claude-company-test';
  
  let bossController: BossControllerV2;
  let subordinateController: SubordinateController;
  let gitManager: GitManager;
  let taskQueue: TaskQueue;

  beforeAll(async () => {
    // テスト環境が整っているかチェック
    const executor = new ClaudeCommandExecutor();
    const available = await executor.checkAvailability();
    
    if (!available) {
      console.warn('Skipping integration tests: Claude Code CLI not available');
      return;
    }
  });

  beforeEach(async () => {
    // テストディレクトリの準備
    await require('fs').promises.mkdir(testWorkspace, { recursive: true });

    // コンポーネントの初期化
    bossController = new BossControllerV2({
      workspacePath: testWorkspace,
      taskTimeout: 10000,
      reviewTimeout: 5000
    });

    subordinateController = new SubordinateController({
      agentId: 'test-subordinate-001',
      workspacePath: testWorkspace,
      taskTimeout: 10000
    });

    gitManager = new GitManager({
      repositoryPath: testWorkspace,
      autoCommit: true
    });

    taskQueue = new TaskQueue();
  });

  afterEach(async () => {
    // クリーンアップ
    try {
      await bossController?.cleanup();
      await subordinateController?.cleanup();
      await gitManager?.cleanup();
      await taskQueue?.close();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }

    // テストディレクトリの削除
    try {
      await require('fs').promises.rmdir(testWorkspace, { recursive: true });
    } catch (error) {
      // ignore
    }
  });

  describe('Basic System Workflow', () => {
    it('should process user instruction end-to-end', async () => {
      // Claude Code CLIが利用可能でない場合はスキップ
      const executor = new ClaudeCommandExecutor();
      const available = await executor.checkAvailability();
      if (!available) {
        console.warn('Skipping test: Claude Code CLI not available');
        return;
      }

      try {
        // 1. システム初期化
        await Promise.all([
          bossController.initialize(),
          subordinateController.initialize(),
          gitManager.initialize(),
          taskQueue.initialize()
        ]);

        // 2. ユーザー指示の処理
        const instruction = {
          id: 'test-instruction-001',
          content: 'Create a simple calculator function that adds two numbers',
          priority: 5,
          timestamp: new Date(),
          userId: 'test-user'
        };

        const decompositionResult = await bossController.processUserInstruction(instruction);

        // 3. タスクの検証
        expect(decompositionResult.tasks).toBeDefined();
        expect(decompositionResult.tasks.length).toBeGreaterThan(0);
        expect(decompositionResult.complexity).toMatch(/^(low|medium|high)$/);

        // 4. タスクをキューに追加
        const jobIds = await bossController.addTasksToQueue(decompositionResult.tasks);
        expect(jobIds.length).toBe(decompositionResult.tasks.length);

        // 5. 部下AIによるタスク実行（シミュレート）
        const mockTask: Task = {
          id: 'test-task-001',
          title: 'Create calculator function',
          description: 'Implement addition function',
          priority: 5,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          dependencies: []
        };

        // タスク実行の結果をシミュレート
        const executionResult = await subordinateController.executeTask(mockTask);
        expect(executionResult.success).toBe(true);

        console.log('Integration test completed successfully');

      } catch (error) {
        console.error('Integration test failed:', error);
        throw error;
      }
    }, 30000); // 30秒タイムアウト

    it('should handle git operations', async () => {
      const executor = new ClaudeCommandExecutor();
      const available = await executor.checkAvailability();
      if (!available) {
        console.warn('Skipping test: Claude Code CLI not available');
        return;
      }

      try {
        await gitManager.initialize();

        // Git status確認
        const statusResult = await gitManager.getStatus();
        expect(statusResult.success).toBe(true);

        // テストファイルの作成とコミット
        const codeChanges = [{
          filePath: 'test-file.txt',
          action: 'CREATE' as const,
          content: 'Test content'
        }];

        const commitResult = await gitManager.autoCommit('test-task', codeChanges);
        expect(commitResult.success).toBe(true);

        console.log('Git integration test completed successfully');

      } catch (error) {
        console.error('Git integration test failed:', error);
        throw error;
      }
    }, 20000);
  });

  describe('Error Handling', () => {
    it('should handle initialization failures gracefully', async () => {
      // 無効なワークスペースパスでテスト
      const invalidController = new BossControllerV2({
        workspacePath: '/invalid/path/that/does/not/exist'
      });

      await expect(invalidController.initialize()).rejects.toThrow();
    });

    it('should handle task execution failures', async () => {
      const executor = new ClaudeCommandExecutor();
      const available = await executor.checkAvailability();
      if (!available) {
        console.warn('Skipping test: Claude Code CLI not available');
        return;
      }

      try {
        await subordinateController.initialize();

        // 不正なタスクでテスト
        const invalidTask: Task = {
          id: 'invalid-task',
          title: '',
          description: '',
          priority: 0,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          dependencies: []
        };

        const result = await subordinateController.executeTask(invalidTask);
        // エラーの場合でも適切に処理されることを確認
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');

      } catch (error) {
        console.error('Error handling test failed:', error);
        throw error;
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent operations', async () => {
      const executor = new ClaudeCommandExecutor();
      const available = await executor.checkAvailability();
      if (!available) {
        console.warn('Skipping test: Claude Code CLI not available');
        return;
      }

      try {
        await Promise.all([
          bossController.initialize(),
          subordinateController.initialize()
        ]);

        // 複数の指示を並行処理
        const instructions = Array.from({ length: 3 }, (_, i) => ({
          id: `concurrent-instruction-${i}`,
          content: `Create function ${i}`,
          priority: 5,
          timestamp: new Date()
        }));

        const startTime = Date.now();
        
        const results = await Promise.all(
          instructions.map(instruction => 
            bossController.processUserInstruction(instruction)
          )
        );

        const executionTime = Date.now() - startTime;

        // 結果の検証
        results.forEach(result => {
          expect(result.tasks).toBeDefined();
          expect(result.tasks.length).toBeGreaterThan(0);
        });

        console.log(`Concurrent operations completed in ${executionTime}ms`);
        expect(executionTime).toBeLessThan(30000); // 30秒以内

      } catch (error) {
        console.error('Performance test failed:', error);
        throw error;
      }
    }, 45000);
  });

  describe('Data Persistence', () => {
    it('should maintain state across operations', async () => {
      const executor = new ClaudeCommandExecutor();
      const available = await executor.checkAvailability();
      if (!available) {
        console.warn('Skipping test: Claude Code CLI not available');
        return;
      }

      try {
        await bossController.initialize();

        // 初期状態の確認
        const initialStatus = bossController.getStatus();
        expect(initialStatus.isInitialized).toBe(true);
        expect(initialStatus.activeInstructions).toBe(0);

        // 指示を処理
        const instruction = {
          id: 'persistence-test-001',
          content: 'Create a test function',
          priority: 5,
          timestamp: new Date()
        };

        await bossController.processUserInstruction(instruction);

        // 状態の変化を確認
        const updatedStatus = bossController.getStatus();
        expect(updatedStatus.activeInstructions).toBe(1);
        expect(updatedStatus.taskHistory).toBe(1);

        console.log('Data persistence test completed successfully');

      } catch (error) {
        console.error('Data persistence test failed:', error);
        throw error;
      }
    });
  });
});
/**
 * ClaudeCommunicationInterface の単体テスト
 */

import { EventEmitter } from 'events';
import { ClaudeCommunicationInterface, CommunicationConfig } from '../communication-interface';
import { ClaudeProcessStatus, ClaudeResponse } from '../types';

// ClaudeProcessManagerのモック
class MockClaudeProcessManager extends EventEmitter {
  private _isRunning = false;
  private _processInfo = {
    status: ClaudeProcessStatus.STOPPED,
    restartCount: 0,
    errorCount: 0
  };

  process = {
    stdin: {
      write: jest.fn((_data: string, callback?: (error: Error | null) => void) => {
        if (callback) callback(null);
        return true;
      }),
      writable: true
    }
  };

  isRunning(): boolean {
    return this._isRunning;
  }

  getProcessInfo() {
    return this._processInfo;
  }

  setRunning(running: boolean) {
    this._isRunning = running;
    this._processInfo.status = running ? ClaudeProcessStatus.RUNNING : ClaudeProcessStatus.STOPPED;
  }

  simulateOutput(data: string) {
    this.emit('output', data);
  }

  simulateError(error: string) {
    this.emit('error', error);
  }

  simulateStatusChange(status: ClaudeProcessStatus) {
    this._processInfo.status = status;
    this.emit('status-change', status);
  }
}

describe('ClaudeCommunicationInterface', () => {
  let communicationInterface: ClaudeCommunicationInterface;
  let mockProcessManager: MockClaudeProcessManager;
  let config: CommunicationConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      defaultTimeout: 5000,
      maxConcurrentCommands: 3,
      retryAttempts: 2,
      retryDelay: 500
    };

    mockProcessManager = new MockClaudeProcessManager();
    mockProcessManager.setRunning(true);
    
    communicationInterface = new ClaudeCommunicationInterface(
      mockProcessManager as any,
      config
    );
  });

  afterEach(async () => {
    await communicationInterface.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const interface1 = new ClaudeCommunicationInterface(mockProcessManager as any);
      expect(interface1).toBeDefined();
    });

    it('should setup process manager listeners', () => {
      const listenerCount = mockProcessManager.listenerCount('output') +
                           mockProcessManager.listenerCount('error') +
                           mockProcessManager.listenerCount('status-change');
      
      expect(listenerCount).toBeGreaterThan(0);
    });
  });

  describe('sendPrompt', () => {
    it('should send prompt successfully', async () => {
      const prompt = 'Test prompt';
      
      // レスポンスをシミュレート
      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success"}');
      }, 100);

      const response = await communicationInterface.sendPrompt(prompt);

      expect(mockProcessManager.process.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining(prompt),
        expect.any(Function)
      );
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should throw error if process is not running', async () => {
      mockProcessManager.setRunning(false);

      await expect(communicationInterface.sendPrompt('test'))
        .rejects.toThrow('Claude process is not running');
    });

    it('should handle timeout', async () => {
      const prompt = 'Test prompt';
      const shortTimeout = 100;

      // タイムアウトが発生するまでレスポンスを送信しない
      const promise = communicationInterface.sendPrompt(prompt, { timeout: shortTimeout });

      await expect(promise).rejects.toThrow('Command timeout');
    });

    it('should handle priority commands', async () => {
      const normalPrompt = 'Normal prompt';
      const priorityPrompt = 'Priority prompt';

      // 通常のコマンドを送信
      const normalPromise = communicationInterface.sendPrompt(normalPrompt);
      
      // 高優先度のコマンドを送信
      const priorityPromise = communicationInterface.sendPrompt(priorityPrompt, { priority: 1 });

      // レスポンスを順番に送信（実装では最初のコマンドが最初に処理される）
      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "first"}');
        setTimeout(() => {
          mockProcessManager.simulateOutput('{"result": "second"}');
        }, 50);
      }, 100);

      const [firstResponse, secondResponse] = await Promise.all([
        normalPromise,
        priorityPromise
      ]);

      expect(firstResponse.data.result).toBe('first');
      expect(secondResponse.data.result).toBe('second');
    });

    it('should respect max concurrent commands limit', async () => {
      const promises: Promise<ClaudeResponse>[] = [];
      
      // 制限を超える数のコマンドを送信
      for (let i = 0; i < config.maxConcurrentCommands! + 2; i++) {
        promises.push(communicationInterface.sendPrompt(`Command ${i}`));
      }

      const status = communicationInterface.getStatus();
      expect(status.pendingCommands).toBeLessThanOrEqual(config.maxConcurrentCommands!);
      expect(status.queuedCommands).toBeGreaterThan(0);

      // すべてのコマンドにレスポンスを送信
      for (let i = 0; i < promises.length; i++) {
        setTimeout(() => {
          mockProcessManager.simulateOutput(`{"result": "response${i}"}`);
        }, 100 * (i + 1));
      }

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(config.maxConcurrentCommands! + 2);
    });
  });

  describe('sendMultiplePrompts', () => {
    it('should send multiple prompts in parallel', async () => {
      const prompts = [
        { prompt: 'Prompt 1' },
        { prompt: 'Prompt 2' },
        { prompt: 'Prompt 3' }
      ];

      // 各プロンプトにレスポンスを送信
      setTimeout(() => {
        prompts.forEach((_, index) => {
          setTimeout(() => {
            mockProcessManager.simulateOutput(`{"result": "response${index + 1}"}`);
          }, 100 * (index + 1));
        });
      }, 100);

      const responses = await communicationInterface.sendMultiplePrompts(prompts);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });
  });

  describe('sendPromptExpectJSON', () => {
    it('should parse JSON response correctly', async () => {
      const prompt = 'Get JSON data';
      const expectedData = { name: 'test', value: 42 };

      setTimeout(() => {
        mockProcessManager.simulateOutput(JSON.stringify(expectedData));
      }, 100);

      const result = await communicationInterface.sendPromptExpectJSON<typeof expectedData>(prompt);

      expect(result).toEqual(expectedData);
    });

    it('should throw error for invalid JSON', async () => {
      const prompt = 'Get invalid JSON';

      setTimeout(() => {
        mockProcessManager.simulateOutput('invalid json');
      }, 100);

      await expect(communicationInterface.sendPromptExpectJSON(prompt))
        .rejects.toThrow('Failed to parse JSON response');
    });

    it('should throw error if command fails', async () => {
      const prompt = 'Failing command';

      setTimeout(() => {
        mockProcessManager.simulateError('Command failed');
      }, 100);

      await expect(communicationInterface.sendPromptExpectJSON(prompt))
        .rejects.toThrow('Command failed');
    });
  });

  describe('cancelCommand', () => {
    it('should cancel pending command', async () => {
      const prompt = 'Long running command';
      const promise = communicationInterface.sendPrompt(prompt);

      // コマンドIDを取得するために少し待つ
      await new Promise(resolve => setTimeout(resolve, 50));

      const commandIds = Array.from((communicationInterface as any).pendingCommands.keys());
      
      if (commandIds.length > 0) {
        const cancelled = communicationInterface.cancelCommand(commandIds[0] as string);
        expect(cancelled).toBe(true);
      }

      await expect(promise).rejects.toThrow('Command cancelled');
    });

    it('should cancel queued command', async () => {
      // 制限を超える数のコマンドを送信してキューに入れる
      const promises: Promise<ClaudeResponse>[] = [];
      for (let i = 0; i < config.maxConcurrentCommands! + 1; i++) {
        promises.push(communicationInterface.sendPrompt(`Command ${i}`));
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // キューにあるコマンドをキャンセル
      const queuedCommands = (communicationInterface as any).commandQueue;
      if (queuedCommands.length > 0) {
        const cancelled = communicationInterface.cancelCommand(queuedCommands[0].command.id);
        expect(cancelled).toBe(true);
      }
    });

    it('should return false for non-existent command', () => {
      const cancelled = communicationInterface.cancelCommand('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('cancelAllCommands', () => {
    it('should cancel all pending and queued commands', async () => {
      const promises: Promise<ClaudeResponse>[] = [];
      
      // 複数のコマンドを送信
      for (let i = 0; i < 5; i++) {
        promises.push(communicationInterface.sendPrompt(`Command ${i}`));
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      communicationInterface.cancelAllCommands();

      // すべてのプロミスがキャンセルエラーで拒否されることを確認
      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toMatch(/cancelled/);
        }
      }

      const status = communicationInterface.getStatus();
      expect(status.pendingCommands).toBe(0);
      expect(status.queuedCommands).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = communicationInterface.getStatus();

      expect(status).toEqual({
        isProcessRunning: true,
        pendingCommands: 0,
        queuedCommands: 0,
        isProcessingQueue: false,
        processInfo: mockProcessManager.getProcessInfo(),
        config: {
          defaultTimeout: 5000,
          maxConcurrentCommands: 3,
          retryAttempts: 2,
          retryDelay: 500
        }
      });
    });

    it('should reflect pending commands', async () => {
      const promise = communicationInterface.sendPrompt('Test command');
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const status = communicationInterface.getStatus();
      expect(status.pendingCommands).toBe(1);

      // レスポンスを送信してコマンドを完了
      mockProcessManager.simulateOutput('{"result": "done"}');
      await promise;
    });
  });

  describe('error handling', () => {
    it('should handle process errors', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateError('Process error occurred');
      }, 100);

      await expect(promise).rejects.toThrow('Process error');
    });

    it('should handle process status changes', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateStatusChange(ClaudeProcessStatus.ERROR);
      }, 100);

      await expect(promise).rejects.toThrow('Process status changed to ERROR');
    });

    it('should handle malformed responses gracefully', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateOutput('malformed response without proper format');
      }, 100);

      const response = await promise;
      expect(response.success).toBe(true);
      expect(response.data).toBe('malformed response without proper format');
    });

    it('should detect error responses in text format', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateOutput('Error: Something went wrong');
      }, 100);

      const response = await promise;
      expect(response.success).toBe(false);
      expect(response.error).toBe('Error: Something went wrong');
    });

    it('should retry commands on error if configured', async () => {
      const promise = communicationInterface.sendPrompt('Test command', { retryOnError: true });

      // 最初のエラー
      setTimeout(() => {
        mockProcessManager.simulateError('First error');
      }, 100);

      // リトライ後の成功
      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success after retry"}');
      }, 1000);

      const response = await promise;
      expect(response.success).toBe(true);
    });

    it('should fail after max retry attempts', async () => {
      const promise = communicationInterface.sendPrompt('Test command', { retryOnError: true });

      // 複数回エラーを発生させる
      for (let i = 0; i < config.retryAttempts! + 1; i++) {
        setTimeout(() => {
          mockProcessManager.simulateError(`Error ${i + 1}`);
        }, 100 + (i * 600));
      }

      await expect(promise).rejects.toThrow('Process error');
    });
  });

  describe('getCommandStatus', () => {
    it('should return pending status for active commands', async () => {
      const promise = communicationInterface.sendPrompt('Test command');
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const commandIds = Array.from((communicationInterface as any).pendingCommands.keys());
      if (commandIds.length > 0) {
        const status = communicationInterface.getCommandStatus(commandIds[0] as string);
        expect(status.status).toBe('pending');
        expect(status.details).toBeDefined();
      }

      // レスポンスを送信してコマンドを完了
      mockProcessManager.simulateOutput('{"result": "done"}');
      await promise;
    });

    it('should return queued status for queued commands', async () => {
      // 制限を超える数のコマンドを送信
      const promises: Promise<ClaudeResponse>[] = [];
      for (let i = 0; i < config.maxConcurrentCommands! + 1; i++) {
        promises.push(communicationInterface.sendPrompt(`Command ${i}`));
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const queuedCommands = (communicationInterface as any).commandQueue;
      if (queuedCommands.length > 0) {
        const status = communicationInterface.getCommandStatus(queuedCommands[0].command.id);
        expect(status.status).toBe('queued');
        expect(status.details).toBeDefined();
      }

      // すべてのコマンドにレスポンスを送信
      for (let i = 0; i < promises.length; i++) {
        setTimeout(() => {
          mockProcessManager.simulateOutput(`{"result": "response${i}"}`);
        }, 100 * (i + 1));
      }

      await Promise.all(promises);
    });

    it('should return not_found for non-existent commands', () => {
      const status = communicationInterface.getCommandStatus('non-existent-id');
      expect(status.status).toBe('not_found');
    });
  });

  describe('sendPromptStream', () => {
    it('should handle streaming responses', async () => {
      const receivedData: string[] = [];
      const onData = (data: string) => {
        receivedData.push(data);
      };

      const promise = communicationInterface.sendPromptStream('Stream test', onData);

      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "streaming data"}');
      }, 100);

      const response = await promise;

      expect(response.success).toBe(true);
      expect(receivedData.length).toBeGreaterThan(0);
    });
  });

  describe('metrics and statistics', () => {
    it('should track command metrics', async () => {
      const promise1 = communicationInterface.sendPrompt('Success command');
      const promise2 = communicationInterface.sendPrompt('Fail command');

      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success"}');
        mockProcessManager.simulateError('Command failed');
      }, 100);

      await Promise.allSettled([promise1, promise2]);

      const metrics = communicationInterface.getMetrics();
      expect(metrics.totalCommands).toBe(2);
      expect(metrics.successfulCommands).toBe(1);
      expect(metrics.failedCommands).toBe(1);
    });

    it('should provide detailed statistics', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success"}');
      }, 100);

      await promise;

      const stats = communicationInterface.getDetailedStats();
      expect(stats.metrics).toBeDefined();
      expect(stats.status).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.performance.successRate).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success"}');
      }, 100);

      await promise;

      communicationInterface.resetMetrics();
      const metrics = communicationInterface.getMetrics();
      expect(metrics.totalCommands).toBe(0);
      expect(metrics.successfulCommands).toBe(0);
    });
  });

  describe('batch processing', () => {
    it('should process prompts in batch with concurrency limit', async () => {
      const prompts = [
        { prompt: 'Batch 1' },
        { prompt: 'Batch 2' },
        { prompt: 'Batch 3' },
        { prompt: 'Batch 4' }
      ];

      let progressCalls = 0;
      const onProgress = (completed: number, total: number) => {
        progressCalls++;
        expect(completed).toBeLessThanOrEqual(total);
        expect(total).toBe(4);
      };

      // レスポンスを順次送信
      setTimeout(() => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            mockProcessManager.simulateOutput(`{"result": "batch${i + 1}"}`);
          }, 100 * (i + 1));
        }
      }, 100);

      const results = await communicationInterface.sendPromptBatch(prompts, {
        maxConcurrency: 2,
        onProgress
      });

      expect(results).toHaveLength(4);
      expect(progressCalls).toBe(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should stop on error when configured', async () => {
      const prompts = [
        { prompt: 'Batch 1' },
        { prompt: 'Batch 2' },
        { prompt: 'Batch 3' }
      ];

      setTimeout(() => {
        mockProcessManager.simulateOutput('{"result": "success"}');
        setTimeout(() => {
          mockProcessManager.simulateError('Batch error');
        }, 100);
      }, 100);

      await expect(
        communicationInterface.sendPromptBatch(prompts, { stopOnError: true })
      ).rejects.toThrow('Batch execution failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const removeAllListenersSpy = jest.spyOn(communicationInterface, 'removeAllListeners');

      await communicationInterface.cleanup();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });

    it('should cancel all commands during cleanup', async () => {
      const promise = communicationInterface.sendPrompt('Test command');

      await communicationInterface.cleanup();

      await expect(promise).rejects.toThrow('All commands cancelled');
    });
  });
});
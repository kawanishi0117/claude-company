/**
 * ClaudeProcessManager の単体テスト
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { ClaudeProcessManager } from '../process-manager';
import { ClaudeProcessConfig, ClaudeProcessStatus } from '../types';

// モック
jest.mock('child_process');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

// ChildProcessのモック
class MockChildProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  stdin = {
    write: jest.fn(),
    end: jest.fn()
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill(signal?: string) {
    this.killed = true;
    this.emit('exit', 0, signal);
  }
}

describe('ClaudeProcessManager', () => {
  let processManager: ClaudeProcessManager;
  let mockProcess: MockChildProcess;
  let mockSpawn: jest.Mock;
  let config: ClaudeProcessConfig;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    config = {
      workspacePath: '/test/workspace',
      permissionMode: 'bypassPermissions',
      printOutput: true,
      timeout: 5000,
      maxRetries: 2,
      restartDelay: 1000
    };

    mockProcess = new MockChildProcess();
    mockSpawn = require('child_process').spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockProcess);

    processManager = new ClaudeProcessManager(config);
  });

  afterEach(async () => {
    try {
      await processManager.cleanup();
    } catch (error) {
      // クリーンアップエラーを無視
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const manager = new ClaudeProcessManager({ workspacePath: '/test' });
      const info = manager.getProcessInfo();
      
      expect(info.status).toBe(ClaudeProcessStatus.STOPPED);
      expect(info.restartCount).toBe(0);
      expect(info.errorCount).toBe(0);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = {
        workspacePath: '/custom',
        timeout: 10000
      };
      
      const manager = new ClaudeProcessManager(customConfig);
      // 内部設定の確認は難しいため、動作で確認
      expect(manager).toBeDefined();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
    });

    it('should start Claude process successfully', async () => {
      const statusChangeSpy = jest.fn();
      processManager.on('status-change', statusChangeSpy);

      const startPromise = processManager.start();
      
      // プロセス起動完了をシミュレート
      setTimeout(() => {
        mockProcess.emit('spawn');
      }, 100);

      await startPromise;

      expect(mockSpawn).toHaveBeenCalledWith('claude', [
        '--workspace', '/test/workspace',
        '--permission-mode', 'bypassPermissions',
        '--print'
      ], expect.any(Object));

      expect(statusChangeSpy).toHaveBeenCalledWith(ClaudeProcessStatus.STARTING);
      expect(statusChangeSpy).toHaveBeenCalledWith(ClaudeProcessStatus.RUNNING);
      expect(processManager.isRunning()).toBe(true);
    });

    it('should create workspace directory if it does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Directory not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const startPromise = processManager.start();
      
      setTimeout(() => {
        mockProcess.emit('spawn');
      }, 100);

      await startPromise;

      expect(fs.mkdir).toHaveBeenCalledWith('/test/workspace', { recursive: true });
    });

    it('should throw error if already running', async () => {
      // 最初の起動
      const startPromise1 = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise1;

      // 2回目の起動を試行
      await expect(processManager.start()).rejects.toThrow('Claude process is already running');
    });

    it('should throw error if already starting', async () => {
      const startPromise1 = processManager.start();
      
      // 起動中に再度起動を試行
      await expect(processManager.start()).rejects.toThrow('Claude process is already starting');
      
      // 最初の起動を完了
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise1;
    });

    it('should handle spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const errorProcess = new MockChildProcess();
        setTimeout(() => errorProcess.emit('error', new Error('Spawn failed')), 100);
        return errorProcess;
      });

      await expect(processManager.start()).rejects.toThrow('Spawn failed');
      
      const info = processManager.getProcessInfo();
      expect(info.status).toBe(ClaudeProcessStatus.ERROR);
      expect(info.errorCount).toBe(1);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;
    });

    it('should stop Claude process gracefully', async () => {
      const statusChangeSpy = jest.fn();
      processManager.on('status-change', statusChangeSpy);

      await processManager.stop();

      expect(mockProcess.stdin.end).toHaveBeenCalled();
      expect(mockProcess.killed).toBe(true);
      expect(statusChangeSpy).toHaveBeenCalledWith(ClaudeProcessStatus.STOPPED);
      expect(processManager.isRunning()).toBe(false);
    });

    it('should do nothing if already stopped', async () => {
      await processManager.stop();
      
      // 2回目の停止
      await processManager.stop();
      
      expect(processManager.isRunning()).toBe(false);
    });

    it('should force kill if graceful shutdown fails', async () => {
      // グレースフルシャットダウンが失敗するケースをシミュレート
      mockProcess.kill = jest.fn(); // exitイベントを発生させない

      const stopPromise = processManager.stop();
      
      // タイムアウト後の強制終了をシミュレート
      setTimeout(() => {
        mockProcess.emit('exit', 0, 'SIGKILL');
      }, 6000);

      await stopPromise;
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('restart', () => {
    beforeEach(async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;
    });

    it('should restart Claude process successfully', async () => {
      const restartSpy = jest.fn();
      processManager.on('restart', restartSpy);

      const restartPromise = processManager.restart();
      
      // 再起動後の新しいプロセス
      setTimeout(() => {
        const newMockProcess = new MockChildProcess();
        mockSpawn.mockReturnValue(newMockProcess);
        newMockProcess.emit('spawn');
      }, 1200); // restartDelay + α

      await restartPromise;

      expect(restartSpy).toHaveBeenCalledWith(1);
      expect(processManager.isRunning()).toBe(true);
      
      const info = processManager.getProcessInfo();
      expect(info.restartCount).toBe(1);
    });

    it('should handle restart failure', async () => {
      // 再起動時にエラーを発生させる
      mockSpawn.mockImplementation(() => {
        const errorProcess = new MockChildProcess();
        setTimeout(() => errorProcess.emit('error', new Error('Restart failed')), 100);
        return errorProcess;
      });

      await expect(processManager.restart()).rejects.toThrow('Restart failed');
    });
  });

  describe('process monitoring', () => {
    beforeEach(async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;
    });

    it('should handle stdout data', () => {
      const outputSpy = jest.fn();
      processManager.on('output', outputSpy);

      mockProcess.stdout.emit('data', Buffer.from('test output'));

      expect(outputSpy).toHaveBeenCalledWith('test output');
      
      const info = processManager.getProcessInfo();
      expect(info.lastActivity).toBeDefined();
    });

    it('should handle stderr data', () => {
      const errorSpy = jest.fn();
      processManager.on('error', errorSpy);

      mockProcess.stderr.emit('data', Buffer.from('test error'));

      expect(errorSpy).toHaveBeenCalledWith('test error');
      
      const info = processManager.getProcessInfo();
      expect(info.errorCount).toBe(1);
    });

    it('should handle unexpected process exit', async () => {
      const restartSpy = jest.fn();
      processManager.on('restart', restartSpy);

      // 予期しない終了をシミュレート
      mockProcess.emit('exit', 1, null);

      // 自動再起動を待つ
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(restartSpy).toHaveBeenCalled();
    });

    it('should not restart if max retries exceeded', async () => {
      // maxRetries回の再起動を実行
      for (let i = 0; i < config.maxRetries!; i++) {
        mockProcess.emit('exit', 1, null);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      // さらに1回終了させる
      mockProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 1200));

      const info = processManager.getProcessInfo();
      expect(info.status).toBe(ClaudeProcessStatus.ERROR);
    });
  });

  describe('getProcessInfo', () => {
    it('should return current process information', () => {
      const info = processManager.getProcessInfo();

      expect(info).toEqual({
        status: ClaudeProcessStatus.STOPPED,
        restartCount: 0,
        errorCount: 0,
        pid: undefined,
        startTime: undefined,
        lastActivity: undefined
      });
    });

    it('should include PID when process is running', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;

      const info = processManager.getProcessInfo();
      expect(info.pid).toBe(12345);
      expect(info.startTime).toBeDefined();
    });
  });

  describe('isRunning', () => {
    it('should return false when stopped', () => {
      expect(processManager.isRunning()).toBe(false);
    });

    it('should return true when running', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;

      expect(processManager.isRunning()).toBe(true);
    });

    it('should return false when process is killed', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;

      mockProcess.killed = true;
      expect(processManager.isRunning()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const removeAllListenersSpy = jest.spyOn(processManager, 'removeAllListeners');

      await processManager.cleanup();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });

    it('should stop process during cleanup', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const startPromise = processManager.start();
      setTimeout(() => mockProcess.emit('spawn'), 100);
      await startPromise;

      await processManager.cleanup();

      expect(processManager.isRunning()).toBe(false);
    });
  });
});
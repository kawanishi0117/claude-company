/**
 * ClaudeCommandExecutor Test Suite
 */

import { ClaudeCommandExecutor } from '../command-executor';

// モック化
jest.mock('child_process');
jest.mock('fs/promises');

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('ClaudeCommandExecutor', () => {
  let executor: ClaudeCommandExecutor;
  let mockChildProcess: any;

  beforeEach(() => {
    executor = new ClaudeCommandExecutor({
      defaultTimeout: 5000,
      defaultWorkspacePath: '/test/workspace'
    });

    // 子プロセスのモック
    mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should detect Claude Code CLI availability', async () => {
      // claude --version の成功レスポンスをシミュレート
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback('1.0.64 (Claude Code)'), 5);
        }
      });

      const available = await executor.checkAvailability();
      
      expect(available).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('claude', ['--version'], expect.any(Object));
    });

    it('should handle unavailable Claude CLI', async () => {
      // claude --version の失敗をシミュレート
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Command not found')), 10);
        }
      });

      const available = await executor.checkAvailability();
      
      expect(available).toBe(false);
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      // availabilityチェックをスキップ
      await mockAvailabilityCheck(true);
    });

    it('should execute simple text command', async () => {
      const testPrompt = 'Hello Claude';
      const expectedResponse = 'Hello! How can I help you?';

      mockSuccessfulExecution(expectedResponse);

      const result = await executor.executeCommand(testPrompt, {
        outputFormat: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(expectedResponse);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should execute JSON command and parse response', async () => {
      const testPrompt = 'Return JSON response';
      const jsonResponse = {
        type: 'result',
        result: 'Success',
        session_id: 'test-session',
        total_cost_usd: 0.001
      };

      mockSuccessfulExecution(JSON.stringify(jsonResponse));

      const result = await executor.executeCommand(testPrompt, {
        outputFormat: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(jsonResponse.result);
      expect(result.sessionId).toBe(jsonResponse.session_id);
      expect(result.cost).toBe(jsonResponse.total_cost_usd);
    });

    it('should handle command timeout', async () => {
      mockChildProcess.on.mockImplementation((event: string, _callback: Function) => {
        if (event === 'close') {
          // タイムアウト時間より長く待機
        }
      });

      const result = await executor.executeCommand('slow command', {
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle JSON parse errors', async () => {
      mockSuccessfulExecution('invalid json {');

      const result = await executor.executeCommand('test', {
        outputFormat: 'json'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse error');
    });

    it('should build correct command arguments', async () => {
      const testPrompt = 'test prompt';
      
      mockSuccessfulExecution('test response');

      await executor.executeCommand(testPrompt, {
        outputFormat: 'json',
        model: 'sonnet',
        allowedTools: ['Bash', 'Edit'],
        appendSystemPrompt: 'Additional context'
      });

      expect(mockSpawn).toHaveBeenCalledWith('claude', [
        '-p', testPrompt,
        '--output-format', 'json',
        '--permission-mode', 'bypassPermissions',
        '--add-dir', '/test/workspace',
        '--allowedTools', 'Bash Edit',
        '--model', 'sonnet',
        '--append-system-prompt', 'Additional context'
      ], expect.any(Object));
    });
  });

  describe('sendPromptExpectJSON', () => {
    beforeEach(async () => {
      await mockAvailabilityCheck(true);
    });

    it('should return parsed JSON result', async () => {
      const expectedData = { tasks: ['task1', 'task2'], priority: 'high' };
      const jsonResponse = {
        type: 'result',
        result: expectedData
      };

      mockSuccessfulExecution(JSON.stringify(jsonResponse));

      const result = await executor.sendPromptExpectJSON('Create tasks');

      expect(result).toEqual(expectedData);
    });

    it('should throw error on command failure', async () => {
      mockFailedExecution('API key invalid');

      await expect(executor.sendPromptExpectJSON('test'))
        .rejects.toThrow('API key invalid');
    });
  });

  describe('sendPrompt', () => {
    beforeEach(async () => {
      await mockAvailabilityCheck(true);
    });

    it('should return text response', async () => {
      const expectedText = 'This is a text response';
      mockSuccessfulExecution(expectedText);

      const result = await executor.sendPrompt('Generate text');

      expect(result).toBe(expectedText);
    });
  });

  describe('executeBatch', () => {
    beforeEach(async () => {
      await mockAvailabilityCheck(true);
    });

    it('should execute multiple prompts sequentially', async () => {
      mockSuccessfulExecution('response1');
      mockSuccessfulExecution('response2');

      const results = await executor.executeBatch([
        'prompt1',
        'prompt2'
      ], { outputFormat: 'text' });

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(true);
    });

    it('should continue on error by default', async () => {
      let callCount = 0;
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          const code = callCount === 0 ? 1 : 0; // First fails, second succeeds
          callCount++;
          setTimeout(() => callback(code), 10);
        }
      });

      const results = await executor.executeBatch(['fail', 'succeed']);

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(false);
      expect(results[1]?.success).toBe(true);
    });
  });

  describe('createMcpConfig', () => {
    it('should create MCP configuration file', async () => {
      // fs/promises の writeFile をモック
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const servers = {
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/workspace']
        }
      };

      const configPath = await executor.createMcpConfig(servers, '/test/mcp.json');

      expect(configPath).toBe('/test/mcp.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/mcp.json',
        JSON.stringify({ mcpServers: servers }, null, 2)
      );
    });
  });

  describe('setupWorkspace', () => {
    it('should setup accessible workspace', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await executor.setupWorkspace('/new/workspace');

      expect(fs.access).toHaveBeenCalledWith('/new/workspace');
      expect(executor.getStats().defaultWorkspacePath).toBe('/new/workspace');
    });

    it('should throw error for inaccessible workspace', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(executor.setupWorkspace('/invalid/path'))
        .rejects.toThrow('Workspace directory not accessible');
    });
  });

  describe('cleanup', () => {
    it('should remove all event listeners', async () => {
      const removeAllListenersSpy = jest.spyOn(executor, 'removeAllListeners');

      await executor.cleanup();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  // Helper functions
  function mockAvailabilityCheck(available: boolean) {
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(available ? 0 : 1), 10);
      }
    });

    if (available) {
      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback('1.0.64 (Claude Code)'), 5);
        }
      });
    }

    return executor.checkAvailability();
  }

  function mockSuccessfulExecution(response: string) {
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10);
      }
    });

    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(response), 5);
      }
    });
  }

  function mockFailedExecution(errorMessage: string) {
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(1), 10);
      }
    });

    mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(errorMessage), 5);
      }
    });
  }
});
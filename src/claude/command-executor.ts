/**
 * Claude Code CLI Command Executor
 * 実際のClaude Code CLIを直接実行するためのクラス
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { LogLevel } from '../models/types';

export interface ClaudeCommandOptions {
  outputFormat?: 'json' | 'text' | 'stream-json';
  mcpConfig?: string;
  workspacePath?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  timeout?: number;
  model?: string;
  appendSystemPrompt?: string;
  permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
}

export interface ClaudeCommandResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  cost?: number;
  sessionId?: string;
  usage?: any;
}

export class ClaudeCommandExecutor extends EventEmitter {
  private defaultTimeout: number;
  private defaultMcpConfig: string | undefined;
  private defaultWorkspacePath: string | undefined;
  private isAvailable: boolean = false;

  constructor(options: {
    defaultTimeout?: number;
    defaultMcpConfig?: string;
    defaultWorkspacePath?: string;
  } = {}) {
    super();
    
    this.defaultTimeout = options.defaultTimeout || 120000; // 2 minutes
    this.defaultMcpConfig = options.defaultMcpConfig ?? undefined;
    this.defaultWorkspacePath = options.defaultWorkspacePath ?? undefined;
  }

  /**
   * Claude Code CLIの利用可能性をチェック
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const result = await this.execCommand('claude', ['--version'], { timeout: 5000 });
      this.isAvailable = result.includes('Claude Code');
      
      if (this.isAvailable) {
        this.log(LogLevel.INFO, 'Claude Code CLI is available');
      } else {
        this.log(LogLevel.ERROR, 'Claude Code CLI not found or invalid version');
      }
      
      return this.isAvailable;
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to check Claude Code CLI availability: ${error}`);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Claude Code CLIコマンドを実行
   */
  async executeCommand(prompt: string, options: ClaudeCommandOptions = {}): Promise<ClaudeCommandResult> {
    if (!this.isAvailable) {
      const available = await this.checkAvailability();
      if (!available) {
        throw new Error('Claude Code CLI is not available');
      }
    }

    const startTime = Date.now();
    
    try {
      this.log(LogLevel.DEBUG, `Executing Claude command with prompt length: ${prompt.length}`);
      
      const args = this.buildCommandArgs(prompt, options);
      const timeout = options.timeout || this.defaultTimeout;
      
      const stdout = await this.execCommand('claude', args, { timeout });
      const duration = Date.now() - startTime;
      
      // JSONレスポンスの場合はパース
      if (options.outputFormat === 'json') {
        try {
          const parsed = JSON.parse(stdout);
          
          this.log(LogLevel.INFO, `Claude command completed successfully in ${duration}ms`);
          
          return {
            success: true,
            result: parsed.result,
            duration,
            cost: parsed.total_cost_usd,
            sessionId: parsed.session_id,
            usage: parsed.usage
          };
        } catch (parseError) {
          this.log(LogLevel.ERROR, `Failed to parse JSON response: ${parseError}`);
          return {
            success: false,
            error: `JSON parse error: ${parseError}`,
            duration
          };
        }
      } else {
        // テキストレスポンスの場合
        return {
          success: true,
          result: stdout.trim(),
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(LogLevel.ERROR, `Claude command failed after ${duration}ms: ${error}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  /**
   * プロンプトを送信してJSONレスポンスを期待
   */
  async sendPromptExpectJSON<T = any>(prompt: string, options: Omit<ClaudeCommandOptions, 'outputFormat'> = {}): Promise<T> {
    const result = await this.executeCommand(prompt, {
      ...options,
      outputFormat: 'json'
    });

    if (!result.success) {
      throw new Error(result.error || 'Command execution failed');
    }

    return result.result as T;
  }

  /**
   * テキストプロンプトを送信
   */
  async sendPrompt(prompt: string, options: Omit<ClaudeCommandOptions, 'outputFormat'> = {}): Promise<string> {
    const result = await this.executeCommand(prompt, {
      ...options,
      outputFormat: 'text'
    });

    if (!result.success) {
      throw new Error(result.error || 'Command execution failed');
    }

    return result.result as string;
  }

  /**
   * 複数のプロンプトを順次実行
   */
  async executeBatch(prompts: string[], options: ClaudeCommandOptions = {}): Promise<ClaudeCommandResult[]> {
    const results: ClaudeCommandResult[] = [];
    
    for (const prompt of prompts) {
      const result = await this.executeCommand(prompt, options);
      results.push(result);
      
      // エラーが発生した場合は中断するかどうかのオプション
      if (!result.success && options.allowedTools?.includes('stopOnError')) {
        break;
      }
    }
    
    return results;
  }

  /**
   * MCPサーバー設定をファイルに書き込み
   */
  async createMcpConfig(servers: Record<string, {
    command: string;
    args: string[];
  }>, configPath?: string): Promise<string> {
    const config = {
      mcpServers: servers
    };
    
    const filePath = configPath || join(process.cwd(), 'mcp-config.json');
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    
    this.log(LogLevel.INFO, `MCP config written to: ${filePath}`);
    return filePath;
  }

  /**
   * ワークスペースディレクトリの設定
   */
  async setupWorkspace(workspacePath: string): Promise<void> {
    try {
      await fs.access(workspacePath);
      this.defaultWorkspacePath = workspacePath;
      this.log(LogLevel.INFO, `Workspace set to: ${workspacePath}`);
    } catch (error) {
      throw new Error(`Workspace directory not accessible: ${workspacePath}`);
    }
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      isAvailable: this.isAvailable,
      defaultTimeout: this.defaultTimeout,
      defaultWorkspacePath: this.defaultWorkspacePath,
      defaultMcpConfig: this.defaultMcpConfig
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.log(LogLevel.INFO, 'ClaudeCommandExecutor cleaned up');
  }

  /**
   * コマンド引数を構築
   */
  private buildCommandArgs(prompt: string, options: ClaudeCommandOptions): string[] {
    const args = ['-p', prompt];
    
    // 基本オプション
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    }
    
    // 権限設定（Docker環境では通常bypassPermissions）
    const permissionMode = options.permissionMode || 'bypassPermissions';
    if (permissionMode !== 'default') {
      args.push('--permission-mode', permissionMode);
    }
    
    // ワークスペース設定
    const workspacePath = options.workspacePath || this.defaultWorkspacePath;
    if (workspacePath) {
      args.push('--add-dir', workspacePath);
    }
    
    // MCP設定
    const mcpConfig = options.mcpConfig || this.defaultMcpConfig;
    if (mcpConfig) {
      args.push('--mcp-config', mcpConfig);
    }
    
    // ツール制限
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(' '));
    }
    
    if (options.disallowedTools && options.disallowedTools.length > 0) {
      args.push('--disallowedTools', options.disallowedTools.join(' '));
    }
    
    // モデル指定
    if (options.model) {
      args.push('--model', options.model);
    }
    
    // システムプロンプト追加
    if (options.appendSystemPrompt) {
      args.push('--append-system-prompt', options.appendSystemPrompt);
    }
    
    return args;
  }

  /**
   * 外部コマンドを実行
   */
  private async execCommand(command: string, args: string[], options: { timeout?: number } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        shell: false
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | undefined;
      
      // タイムアウト設定
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });
      
      child.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });
    });
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [ClaudeCommandExecutor] ${message}`);
    this.emit('log', { level, message, timestamp });
  }
}
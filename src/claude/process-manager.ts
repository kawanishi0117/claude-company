/**
 * Claude Code CLIプロセス管理クラス
 * プロセスの起動・停止・再起動、標準入出力の監視、自動復旧機能を提供
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { LogLevel } from '../models/types';
import {
  ClaudeProcessConfig,
  ClaudeProcessInfo,
  ClaudeProcessStatus,
  ClaudeResponse,
  ClaudeCommand,
  ClaudeProcessEvents
} from './types';

export class ClaudeProcessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: Required<ClaudeProcessConfig>;
  private processInfo: ClaudeProcessInfo;
  private pendingCommands: Map<string, {
    command: ClaudeCommand;
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private outputBuffer: string = '';
  private isShuttingDown: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: ClaudeProcessConfig) {
    super();
    
    // デフォルト設定をマージ
    this.config = {
      workspacePath: config.workspacePath,
      permissionMode: config.permissionMode || 'bypassPermissions',
      printOutput: config.printOutput !== false,
      timeout: config.timeout || 30000, // 30秒
      maxRetries: config.maxRetries || 3,
      restartDelay: config.restartDelay || 5000 // 5秒
    };

    this.processInfo = {
      status: ClaudeProcessStatus.STOPPED,
      restartCount: 0,
      errorCount: 0
    };

    // TypeScriptのEventEmitterの型安全性を向上
    this.setMaxListeners(20);
  }

  /**
   * Claude Code CLIプロセスを起動
   */
  async start(): Promise<void> {
    if (this.processInfo.status === ClaudeProcessStatus.RUNNING) {
      throw new Error('Claude process is already running');
    }

    if (this.processInfo.status === ClaudeProcessStatus.STARTING) {
      throw new Error('Claude process is already starting');
    }

    this.log(LogLevel.INFO, 'Starting Claude Code CLI process');
    this.updateStatus(ClaudeProcessStatus.STARTING);

    try {
      // ワークスペースディレクトリの存在確認・作成
      await this.ensureWorkspaceExists();

      // Claude Code CLIプロセスを起動
      const args = [
        '--workspace', this.config.workspacePath,
        '--permission-mode', this.config.permissionMode
      ];

      if (this.config.printOutput) {
        args.push('--print');
      }

      this.process = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workspacePath,
        env: {
          ...process.env,
          // Claude CLI用の環境変数があれば設定
        }
      });

      this.setupProcessHandlers();
      this.startHealthCheck();

      // プロセス起動の確認を待つ
      await this.waitForProcessReady();

      this.processInfo.startTime = new Date();
      this.processInfo.lastActivity = new Date();
      this.updateStatus(ClaudeProcessStatus.RUNNING);

      this.log(LogLevel.INFO, `Claude Code CLI process started successfully (PID: ${this.process.pid})`);

    } catch (error) {
      this.processInfo.errorCount++;
      this.updateStatus(ClaudeProcessStatus.ERROR);
      this.log(LogLevel.ERROR, `Failed to start Claude process: ${error}`);
      throw error;
    }
  }

  /**
   * Claude Code CLIプロセスを停止
   */
  async stop(): Promise<void> {
    if (this.processInfo.status === ClaudeProcessStatus.STOPPED) {
      return;
    }

    this.log(LogLevel.INFO, 'Stopping Claude Code CLI process');
    this.isShuttingDown = true;

    // ヘルスチェックを停止
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // 保留中のコマンドをキャンセル
    this.cancelPendingCommands();

    if (this.process) {
      // グレースフルシャットダウンを試行
      this.process.stdin?.end();
      
      // プロセス終了を待つ（タイムアウト付き）
      const shutdownPromise = new Promise<void>((resolve) => {
        if (!this.process) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.log(LogLevel.WARN, 'Force killing Claude process due to timeout');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // 通常の終了シグナルを送信
      this.process.kill('SIGTERM');
      await shutdownPromise;
    }

    this.process = null;
    this.isShuttingDown = false;
    this.updateStatus(ClaudeProcessStatus.STOPPED);
    this.log(LogLevel.INFO, 'Claude Code CLI process stopped');
  }

  /**
   * Claude Code CLIプロセスを再起動
   */
  async restart(): Promise<void> {
    this.log(LogLevel.INFO, 'Restarting Claude Code CLI process');
    this.updateStatus(ClaudeProcessStatus.RESTARTING);
    
    try {
      await this.stop();
      
      // 再起動遅延
      if (this.config.restartDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
      }
      
      await this.start();
      this.processInfo.restartCount++;
      
      this.emit('restart', this.processInfo.restartCount);
      this.log(LogLevel.INFO, `Claude process restarted (restart count: ${this.processInfo.restartCount})`);
      
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to restart Claude process: ${error}`);
      throw error;
    }
  }

  /**
   * プロセス情報を取得
   */
  getProcessInfo(): ClaudeProcessInfo {
    return {
      ...this.processInfo,
      pid: this.process?.pid || undefined
    };
  }

  /**
   * プロセスが実行中かどうかを確認
   */
  isRunning(): boolean {
    return this.processInfo.status === ClaudeProcessStatus.RUNNING && 
           this.process !== null && 
           !this.process.killed;
  }

  /**
   * プロセスハンドラーを設定
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    // 標準出力の監視
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.handleOutput(output);
      this.emit('output', output);
    });

    // 標準エラーの監視
    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      this.handleError(error);
      this.emit('error', error);
    });

    // プロセス終了の監視
    this.process.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });

    // プロセスエラーの監視
    this.process.on('error', (error) => {
      this.handleProcessError(error);
    });
  }

  /**
   * 標準出力を処理
   */
  private handleOutput(data: string): void {
    this.outputBuffer += data;
    this.processInfo.lastActivity = new Date();
    
    // レスポンスの解析を試行
    this.tryParseResponse();
  }

  /**
   * 標準エラーを処理
   */
  private handleError(data: string): void {
    this.log(LogLevel.ERROR, `Claude CLI stderr: ${data}`);
    this.processInfo.lastActivity = new Date();
    this.processInfo.errorCount++;
  }

  /**
   * プロセス終了を処理
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.log(LogLevel.WARN, `Claude process exited with code ${code}, signal ${signal}`);
    
    if (!this.isShuttingDown) {
      // 予期しない終了の場合、自動復旧を試行
      this.handleUnexpectedExit();
    }
  }

  /**
   * プロセスエラーを処理
   */
  private handleProcessError(error: Error): void {
    this.log(LogLevel.ERROR, `Claude process error: ${error.message}`);
    this.processInfo.errorCount++;
    
    if (!this.isShuttingDown) {
      this.handleUnexpectedExit();
    }
  }

  /**
   * 予期しない終了を処理（自動復旧）
   */
  private async handleUnexpectedExit(): Promise<void> {
    this.updateStatus(ClaudeProcessStatus.ERROR);
    
    if (this.processInfo.restartCount < this.config.maxRetries) {
      this.log(LogLevel.WARN, `Attempting automatic restart (${this.processInfo.restartCount + 1}/${this.config.maxRetries})`);
      
      try {
        await this.restart();
      } catch (error) {
        this.log(LogLevel.ERROR, `Automatic restart failed: ${error}`);
        
        if (this.processInfo.restartCount >= this.config.maxRetries) {
          this.log(LogLevel.ERROR, 'Maximum restart attempts reached. Manual intervention required.');
        }
      }
    } else {
      this.log(LogLevel.ERROR, 'Maximum restart attempts reached. Process will remain stopped.');
    }
  }

  /**
   * レスポンスの解析を試行
   */
  private tryParseResponse(): void {
    // Claude CLIの出力形式に応じてレスポンスを解析
    // 実際の実装では、Claude CLIの出力形式を確認して適切に解析する必要がある
    const lines = this.outputBuffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]?.trim();
      if (line) {
        // 簡単な例：JSON形式のレスポンスを想定
        try {
          const response = JSON.parse(line);
          this.handleResponse(response);
        } catch {
          // JSON以外の出力は無視するか、別途処理
        }
      }
    }
    
    // 最後の不完全な行をバッファに保持
    this.outputBuffer = lines[lines.length - 1] || '';
  }

  /**
   * レスポンスを処理
   */
  private handleResponse(data: any): void {
    // 実際の実装では、Claude CLIのレスポンス形式に応じて処理
    const response: ClaudeResponse = {
      success: true,
      data: data,
      executionTime: 0, // 実際の実行時間を計算
      timestamp: new Date()
    };
    
    this.emit('response', response);
  }

  /**
   * ワークスペースディレクトリの存在確認・作成
   */
  private async ensureWorkspaceExists(): Promise<void> {
    try {
      await fs.access(this.config.workspacePath);
    } catch {
      await fs.mkdir(this.config.workspacePath, { recursive: true });
      this.log(LogLevel.INFO, `Created workspace directory: ${this.config.workspacePath}`);
    }
  }

  /**
   * プロセス起動完了を待つ
   */
  private async waitForProcessReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claude process startup timeout'));
      }, 10000); // 10秒でタイムアウト

      // プロセスが正常に起動したことを確認する方法
      // 実際の実装では、Claude CLIの起動完了シグナルを待つ
      const checkReady = () => {
        if (this.process && this.process.pid) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * ヘルスチェックを開始
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (!this.isRunning()) {
        this.log(LogLevel.WARN, 'Health check failed: process is not running');
        this.handleUnexpectedExit();
      }
    }, 30000); // 30秒間隔
  }

  /**
   * 保留中のコマンドをキャンセル
   */
  private cancelPendingCommands(): void {
    for (const [, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Process is shutting down'));
    }
    this.pendingCommands.clear();
  }

  /**
   * ステータスを更新
   */
  private updateStatus(status: ClaudeProcessStatus): void {
    const oldStatus = this.processInfo.status;
    this.processInfo.status = status;
    
    if (oldStatus !== status) {
      this.emit('status-change', status);
    }
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [ClaudeProcessManager] ${message}`);
    
    // 実際の実装では、ログ集約システムに送信
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}

// TypeScriptのEventEmitterの型安全性を向上
export interface ClaudeProcessManager {
  on<K extends keyof ClaudeProcessEvents>(event: K, listener: ClaudeProcessEvents[K]): this;
  emit<K extends keyof ClaudeProcessEvents>(event: K, ...args: Parameters<ClaudeProcessEvents[K]>): boolean;
}
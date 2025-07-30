/**
 * Claude Code CLIとの通信インターフェース
 * プロンプト送信、レスポンス受信、タイムアウト処理、エラーハンドリングを提供
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LogLevel } from '../models/types';
import { ClaudeProcessManager } from './process-manager';
import {
  ClaudeResponse,
  ClaudeCommand,
  ClaudeProcessStatus
} from './types';

export interface CommunicationConfig {
  defaultTimeout?: number;
  maxConcurrentCommands?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface CommandOptions {
  timeout?: number;
  priority?: number;
  retryOnError?: boolean;
}

export interface ParsedResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export class ClaudeCommunicationInterface extends EventEmitter {
  private processManager: ClaudeProcessManager;
  private config: Required<CommunicationConfig>;
  private pendingCommands: Map<string, {
    command: ClaudeCommand;
    options: CommandOptions;
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    retryCount: number;
  }> = new Map();
  private commandQueue: Array<{
    command: ClaudeCommand;
    options: CommandOptions;
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;

  constructor(processManager: ClaudeProcessManager, config: CommunicationConfig = {}) {
    super();
    
    this.processManager = processManager;
    this.config = {
      defaultTimeout: config.defaultTimeout || 30000, // 30秒
      maxConcurrentCommands: config.maxConcurrentCommands || 5,
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 1000 // 1秒
    };

    this.setupProcessManagerListeners();
  }

  /**
   * Claude Code CLIにプロンプトを送信
   */
  async sendPrompt(prompt: string, options: CommandOptions = {}): Promise<ClaudeResponse> {
    if (!this.processManager.isRunning()) {
      throw new Error('Claude process is not running');
    }

    const command: ClaudeCommand = {
      id: uuidv4(),
      prompt: prompt.trim(),
      timestamp: new Date(),
      timeout: options.timeout || this.config.defaultTimeout
    };

    this.log(LogLevel.DEBUG, `Sending command: ${command.id}`);

    return new Promise((resolve, reject) => {
      const commandData = {
        command,
        options,
        resolve,
        reject
      };

      // 優先度に基づいてキューに追加
      if (options.priority && options.priority > 0) {
        // 高優先度のコマンドは前に挿入
        this.commandQueue.unshift(commandData);
      } else {
        this.commandQueue.push(commandData);
      }

      this.processQueue();
    });
  }

  /**
   * 複数のプロンプトを並行して送信
   */
  async sendMultiplePrompts(
    prompts: Array<{ prompt: string; options?: CommandOptions }>
  ): Promise<ClaudeResponse[]> {
    const promises = prompts.map(({ prompt, options }) => 
      this.sendPrompt(prompt, options)
    );

    return Promise.all(promises);
  }

  /**
   * プロンプトを送信し、特定の形式のレスポンスを期待
   */
  async sendPromptExpectJSON<T = any>(
    prompt: string, 
    options: CommandOptions = {}
  ): Promise<T> {
    const response = await this.sendPrompt(prompt, options);
    
    if (!response.success) {
      throw new Error(`Command failed: ${response.error}`);
    }

    try {
      return this.parseJSONResponse<T>(response.data);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * コマンドをキャンセル
   */
  cancelCommand(commandId: string): boolean {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Command cancelled'));
      this.pendingCommands.delete(commandId);
      this.log(LogLevel.INFO, `Command cancelled: ${commandId}`);
      return true;
    }

    // キュー内のコマンドもキャンセル
    const queueIndex = this.commandQueue.findIndex(item => item.command.id === commandId);
    if (queueIndex !== -1) {
      const item = this.commandQueue.splice(queueIndex, 1)[0];
      if (item) {
        item.reject(new Error('Command cancelled'));
        this.log(LogLevel.INFO, `Queued command cancelled: ${commandId}`);
        return true;
      }
    }

    return false;
  }

  /**
   * すべての保留中のコマンドをキャンセル
   */
  cancelAllCommands(): void {
    // 実行中のコマンドをキャンセル
    for (const [, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('All commands cancelled'));
    }
    this.pendingCommands.clear();

    // キュー内のコマンドをキャンセル
    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift()!;
      item.reject(new Error('All commands cancelled'));
    }

    this.log(LogLevel.INFO, 'All commands cancelled');
  }

  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      isProcessRunning: this.processManager.isRunning(),
      pendingCommands: this.pendingCommands.size,
      queuedCommands: this.commandQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      processInfo: this.processManager.getProcessInfo()
    };
  }

  /**
   * コマンドキューを処理
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    if (this.pendingCommands.size >= this.config.maxConcurrentCommands) {
      return; // 同時実行数の上限に達している
    }

    this.isProcessingQueue = true;

    try {
      while (
        this.commandQueue.length > 0 && 
        this.pendingCommands.size < this.config.maxConcurrentCommands &&
        this.processManager.isRunning()
      ) {
        const item = this.commandQueue.shift()!;
        await this.executeCommand(item);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * コマンドを実行
   */
  private async executeCommand(item: {
    command: ClaudeCommand;
    options: CommandOptions;
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
  }): Promise<void> {
    const { command, options, resolve, reject } = item;

    // タイムアウトを設定
    const timeout = setTimeout(() => {
      this.handleCommandTimeout(command.id);
    }, command.timeout!);

    // 保留中のコマンドに追加
    this.pendingCommands.set(command.id, {
      command,
      options,
      resolve,
      reject,
      timeout,
      retryCount: 0
    });

    try {
      // Claude CLIにコマンドを送信
      await this.sendToProcess(command);
      this.log(LogLevel.DEBUG, `Command sent to process: ${command.id}`);
    } catch (error) {
      // 送信エラーの場合
      clearTimeout(timeout);
      this.pendingCommands.delete(command.id);
      reject(error as Error);
    }
  }

  /**
   * プロセスにコマンドを送信
   */
  private async sendToProcess(command: ClaudeCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.processManager.isRunning()) {
        reject(new Error('Process is not running'));
        return;
      }

      // Claude CLIの入力形式に応じてコマンドを整形
      const formattedCommand = this.formatCommand(command);
      
      // プロセスの標準入力に書き込み
      const process = (this.processManager as any).process;
      if (process && process.stdin && process.stdin.writable) {
        process.stdin.write(formattedCommand + '\n', (error: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Process stdin is not writable'));
      }
    });
  }

  /**
   * コマンドを Claude CLI の形式に整形
   */
  private formatCommand(command: ClaudeCommand): string {
    // Claude CLIの実際の入力形式に応じて調整
    // 例：プロンプトをそのまま送信、または特定の形式でラップ
    return command.prompt;
  }

  /**
   * プロセスマネージャーのイベントリスナーを設定
   */
  private setupProcessManagerListeners(): void {
    this.processManager.on('output', (data: string) => {
      this.handleProcessOutput(data);
    });

    this.processManager.on('error', (error: string) => {
      this.handleProcessError(error);
    });

    this.processManager.on('status-change', (status: ClaudeProcessStatus) => {
      this.handleProcessStatusChange(status);
    });
  }

  /**
   * プロセス出力を処理
   */
  private handleProcessOutput(data: string): void {
    try {
      const response = this.parseResponse(data);
      if (response) {
        this.handleResponse(response);
      }
    } catch (error) {
      this.log(LogLevel.WARN, `Failed to parse process output: ${error}`);
    }
  }

  /**
   * プロセスエラーを処理
   */
  private handleProcessError(error: string): void {
    this.log(LogLevel.ERROR, `Process error: ${error}`);
    
    // 実行中のコマンドにエラーを通知
    for (const [id, pending] of this.pendingCommands) {
      if (pending.options.retryOnError && pending.retryCount < this.config.retryAttempts) {
        this.retryCommand(id);
      } else {
        this.rejectCommand(id, new Error(`Process error: ${error}`));
      }
    }
  }

  /**
   * プロセスステータス変更を処理
   */
  private handleProcessStatusChange(status: ClaudeProcessStatus): void {
    if (status === ClaudeProcessStatus.ERROR || status === ClaudeProcessStatus.STOPPED) {
      // プロセスが停止またはエラー状態の場合、保留中のコマンドを失敗させる
      for (const [id] of this.pendingCommands) {
        this.rejectCommand(id, new Error(`Process status changed to ${status}`));
      }
    }
  }

  /**
   * レスポンスを解析
   */
  private parseResponse(data: string): ParsedResponse | null {
    // Claude CLIの出力形式に応じて解析
    // 実際の実装では、Claude CLIの出力形式を確認して適切に解析
    
    try {
      // JSON形式のレスポンスを想定
      const parsed = JSON.parse(data.trim());
      return {
        success: true,
        data: parsed,
        metadata: {
          rawData: data,
          timestamp: new Date()
        }
      };
    } catch {
      // JSON以外の場合はテキストとして処理
      if (data.trim()) {
        return {
          success: true,
          data: data.trim(),
          metadata: {
            rawData: data,
            timestamp: new Date(),
            type: 'text'
          }
        };
      }
    }

    return null;
  }

  /**
   * レスポンスを処理
   */
  private handleResponse(parsedResponse: ParsedResponse): void {
    // 実際の実装では、レスポンスと対応するコマンドを関連付ける必要がある
    // ここでは簡単な例として、最も古いコマンドに対するレスポンスとして処理
    
    const oldestCommand = Array.from(this.pendingCommands.entries())[0];
    if (oldestCommand) {
      const [commandId, pending] = oldestCommand;
      
      const response: ClaudeResponse = {
        success: parsedResponse.success,
        data: parsedResponse.data,
        error: parsedResponse.error || undefined,
        executionTime: Date.now() - pending.command.timestamp.getTime(),
        timestamp: new Date()
      };

      this.resolveCommand(commandId, response);
    }
  }

  /**
   * コマンドタイムアウトを処理
   */
  private handleCommandTimeout(commandId: string): void {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      if (pending.options.retryOnError && pending.retryCount < this.config.retryAttempts) {
        this.retryCommand(commandId);
      } else {
        this.rejectCommand(commandId, new Error('Command timeout'));
      }
    }
  }

  /**
   * コマンドをリトライ
   */
  private async retryCommand(commandId: string): Promise<void> {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;

    pending.retryCount++;
    this.log(LogLevel.WARN, `Retrying command ${commandId} (attempt ${pending.retryCount}/${this.config.retryAttempts})`);

    // リトライ遅延
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

    try {
      // 新しいタイムアウトを設定
      clearTimeout(pending.timeout);
      pending.timeout = setTimeout(() => {
        this.handleCommandTimeout(commandId);
      }, pending.command.timeout!);

      // コマンドを再送信
      await this.sendToProcess(pending.command);
    } catch (error) {
      this.rejectCommand(commandId, error as Error);
    }
  }

  /**
   * コマンドを解決
   */
  private resolveCommand(commandId: string, response: ClaudeResponse): void {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(commandId);
      pending.resolve(response);
      
      this.log(LogLevel.DEBUG, `Command resolved: ${commandId}`);
      
      // キューの処理を継続
      this.processQueue();
    }
  }

  /**
   * コマンドを拒否
   */
  private rejectCommand(commandId: string, error: Error): void {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(commandId);
      pending.reject(error);
      
      this.log(LogLevel.ERROR, `Command rejected: ${commandId} - ${error.message}`);
      
      // キューの処理を継続
      this.processQueue();
    }
  }

  /**
   * JSONレスポンスを解析
   */
  private parseJSONResponse<T>(data: any): T {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data as T;
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [ClaudeCommunicationInterface] ${message}`);
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    this.cancelAllCommands();
    this.removeAllListeners();
  }
}
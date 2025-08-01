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
  error?: string | undefined;
  metadata?: Record<string, any>;
}

export interface CommunicationMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  timeoutCount: number;
  retryCount: number;
  queueWaitTime: number;
  lastCommandTime?: Date;
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
    queuedAt: Date;
  }> = new Map();
  private commandQueue: Array<{
    command: ClaudeCommand;
    options: CommandOptions;
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
    queuedAt: Date;
  }> = [];
  private isProcessingQueue: boolean = false;
  private metrics: CommunicationMetrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
    timeoutCount: 0,
    retryCount: 0,
    queueWaitTime: 0
  };

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
        reject,
        queuedAt: new Date()
      };

      // メトリクス更新
      this.metrics.totalCommands++;

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
   * バッチ処理でプロンプトを送信（順次実行）
   */
  async sendPromptBatch(
    prompts: Array<{ prompt: string; options?: CommandOptions }>,
    batchOptions: {
      maxConcurrency?: number;
      stopOnError?: boolean;
      onProgress?: (completed: number, total: number, result: ClaudeResponse) => void;
    } = {}
  ): Promise<ClaudeResponse[]> {
    const {
      maxConcurrency = 3,
      stopOnError = false,
      onProgress
    } = batchOptions;

    const results: ClaudeResponse[] = [];
    const errors: Error[] = [];
    let completed = 0;

    // プロンプトを並行度制限付きで実行
    const executePrompt = async (promptData: { prompt: string; options?: CommandOptions }, index: number) => {
      try {
        const result = await this.sendPrompt(promptData.prompt, promptData.options);
        results[index] = result;
        completed++;
        
        if (onProgress) {
          onProgress(completed, prompts.length, result);
        }
        
        return result;
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        
        if (stopOnError) {
          throw err;
        }
        
        // エラーの場合もレスポンスオブジェクトを作成
        const errorResponse: ClaudeResponse = {
          success: false,
          error: err.message,
          executionTime: 0,
          timestamp: new Date()
        };
        
        results[index] = errorResponse;
        completed++;
        
        if (onProgress) {
          onProgress(completed, prompts.length, errorResponse);
        }
        
        return errorResponse;
      }
    };

    // 並行度制限付きで実行
    const semaphore = new Array(maxConcurrency).fill(null);
    const executeWithSemaphore = async (promptData: { prompt: string; options?: CommandOptions }, index: number) => {
      // セマフォを取得
      await new Promise<void>(resolve => {
        const tryAcquire = () => {
          const freeIndex = semaphore.findIndex(slot => slot === null);
          if (freeIndex !== -1) {
            semaphore[freeIndex] = index;
            resolve();
          } else {
            setTimeout(tryAcquire, 10);
          }
        };
        tryAcquire();
      });

      try {
        return await executePrompt(promptData, index);
      } finally {
        // セマフォを解放
        const semaphoreIndex = semaphore.indexOf(index);
        if (semaphoreIndex !== -1) {
          semaphore[semaphoreIndex] = null;
        }
      }
    };

    // すべてのプロンプトを実行
    const promises = prompts.map((promptData, index) => 
      executeWithSemaphore(promptData, index)
    );

    await Promise.all(promises);

    if (errors.length > 0 && stopOnError) {
      throw new Error(`Batch execution failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return results;
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
      processInfo: this.processManager.getProcessInfo(),
      config: {
        defaultTimeout: this.config.defaultTimeout,
        maxConcurrentCommands: this.config.maxConcurrentCommands,
        retryAttempts: this.config.retryAttempts,
        retryDelay: this.config.retryDelay
      }
    };
  }

  /**
   * 特定のコマンドの状態を取得
   */
  getCommandStatus(commandId: string): {
    status: 'pending' | 'queued' | 'not_found';
    details?: any;
  } {
    if (this.pendingCommands.has(commandId)) {
      const pending = this.pendingCommands.get(commandId)!;
      return {
        status: 'pending',
        details: {
          command: pending.command,
          retryCount: pending.retryCount,
          options: pending.options
        }
      };
    }

    const queuedCommand = this.commandQueue.find(item => item.command.id === commandId);
    if (queuedCommand) {
      return {
        status: 'queued',
        details: {
          command: queuedCommand.command,
          options: queuedCommand.options
        }
      };
    }

    return { status: 'not_found' };
  }

  /**
   * プロンプトをストリーミング形式で送信
   */
  async sendPromptStream(
    prompt: string,
    onData: (data: string) => void,
    options: CommandOptions = {}
  ): Promise<ClaudeResponse> {
    if (!this.processManager.isRunning()) {
      throw new Error('Claude process is not running');
    }

    const command: ClaudeCommand = {
      id: uuidv4(),
      prompt: `${prompt.trim()} --stream`,  // ストリーミングフラグを追加
      timestamp: new Date(),
      timeout: options.timeout || this.config.defaultTimeout
    };

    this.log(LogLevel.DEBUG, `Sending streaming command: ${command.id}`);

    return new Promise((resolve, reject) => {
      let streamBuffer = '';
      let finalResponse: ClaudeResponse | null = null;

      // ストリーミングデータハンドラー
      const handleStreamData = (data: string) => {
        streamBuffer += data;
        
        // 行ごとに処理
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || ''; // 最後の不完全な行を保持

        for (const line of lines) {
          if (line.trim()) {
            // ストリーミングデータをコールバックに送信
            onData(line);
            
            // 終了マーカーをチェック
            if (line.includes('[STREAM_END]')) {
              // 最終レスポンスを構築
              finalResponse = {
                success: true,
                data: streamBuffer || 'Stream completed',
                executionTime: Date.now() - command.timestamp.getTime(),
                timestamp: new Date()
              };
            }
          }
        }
      };

      // 通常のコマンド送信と同様の処理だが、ストリーミング対応
      const commandData = {
        command,
        options,
        resolve: (response: ClaudeResponse) => {
          if (finalResponse) {
            resolve(finalResponse);
          } else {
            // ストリーミングが完了していない場合は通常のレスポンスを返す
            if (response.success && response.data) {
              onData(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
            }
            resolve(response);
          }
        },
        reject,
        queuedAt: new Date()
      };

      // 一時的にストリーミングハンドラーを設定
      const originalHandler = this.processManager.listeners('output')[0] as ((data: string) => void) | undefined;
      this.processManager.removeAllListeners('output');
      this.processManager.on('output', handleStreamData);

      // コマンドをキューに追加
      if (options.priority && options.priority > 0) {
        this.commandQueue.unshift(commandData);
      } else {
        this.commandQueue.push(commandData);
      }

      this.processQueue();

      // タイムアウト後に元のハンドラーを復元
      setTimeout(() => {
        this.processManager.removeListener('output', handleStreamData);
        if (originalHandler) {
          this.processManager.on('output', originalHandler);
        }
      }, command.timeout! + 1000);
    });
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
    queuedAt: Date;
  }): Promise<void> {
    const { command, options, resolve, reject, queuedAt } = item;

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
      retryCount: 0,
      queuedAt
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
    // コマンドIDを含めることで、レスポンスとの関連付けを可能にする
    const formattedPrompt = `[CMD:${command.id}] ${command.prompt}`;
    return formattedPrompt;
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
    const commandIds = Array.from(this.pendingCommands.keys());
    for (const id of commandIds) {
      const pending = this.pendingCommands.get(id);
      if (pending) {
        if (pending.options.retryOnError && pending.retryCount < this.config.retryAttempts) {
          this.retryCommand(id);
        } else {
          this.rejectCommand(id, new Error(`Process error: ${error}`));
        }
      }
    }
  }

  /**
   * プロセスステータス変更を処理
   */
  private handleProcessStatusChange(status: ClaudeProcessStatus): void {
    this.log(LogLevel.INFO, `Process status changed to: ${status}`);
    
    if (status === ClaudeProcessStatus.ERROR || status === ClaudeProcessStatus.STOPPED) {
      // プロセスが停止またはエラー状態の場合、保留中のコマンドを失敗させる
      const commandIds = Array.from(this.pendingCommands.keys());
      for (const id of commandIds) {
        this.rejectCommand(id, new Error(`Process status changed to ${status}`));
      }
      
      // キュー内のコマンドも失敗させる
      while (this.commandQueue.length > 0) {
        const item = this.commandQueue.shift()!;
        item.reject(new Error(`Process status changed to ${status}`));
      }
    }
  }

  /**
   * レスポンスを解析
   */
  private parseResponse(data: string): ParsedResponse | null {
    // Claude CLIの出力形式に応じて解析
    const trimmedData = data.trim();
    if (!trimmedData) return null;

    // コマンドIDの抽出を試行
    let commandId: string | undefined;
    let responseData = trimmedData;
    
    // 複数のコマンドID形式をサポート
    const cmdIdPatterns = [
      /^\[RESP:([^\]]+)\]\s*(.*)/,  // [RESP:id] format
      /^\[CMD:([^\]]+)\]\s*RESPONSE:\s*(.*)/,  // [CMD:id] RESPONSE: format
      /^Response for ([^:]+):\s*(.*)/  // Response for id: format
    ];

    for (const pattern of cmdIdPatterns) {
      const match = trimmedData.match(pattern);
      if (match) {
        commandId = match[1];
        responseData = match[2] || '';
        break;
      }
    }

    // JSON形式のレスポンスを試行
    try {
      const parsed = JSON.parse(responseData);
      return {
        success: true,
        data: parsed,
        metadata: {
          commandId,
          rawData: data,
          timestamp: new Date(),
          type: 'json',
          size: data.length
        }
      };
    } catch (jsonError) {
      // JSON以外の場合はテキストとして処理
      if (responseData) {
        // より詳細なエラー検出パターン
        const errorPatterns = [
          /error|failed|exception|invalid|denied|forbidden/i,
          /\berror\b|\bfail\b|\bexception\b/i,
          /^(ERROR|FAIL|EXCEPTION):/i
        ];
        
        const isError = errorPatterns.some(pattern => pattern.test(responseData));
        
        // 成功パターンの検出
        const successPatterns = [
          /success|completed|done|ok|ready/i,
          /^(SUCCESS|COMPLETED|DONE|OK):/i
        ];
        
        const isSuccess = successPatterns.some(pattern => pattern.test(responseData));
        
        return {
          success: isSuccess || !isError,
          data: (!isError && !isSuccess) ? responseData : (isSuccess ? responseData : undefined),
          error: isError ? responseData : undefined,
          metadata: {
            commandId,
            rawData: data,
            timestamp: new Date(),
            type: 'text',
            size: data.length,
            jsonParseError: jsonError instanceof Error ? jsonError.message : String(jsonError)
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
    // レスポンスにコマンドIDが含まれている場合はそれを使用
    // そうでなければ、最も古いコマンドに対するレスポンスとして処理
    let commandId: string | undefined;
    
    if (parsedResponse.metadata?.commandId) {
      commandId = parsedResponse.metadata.commandId;
    } else {
      // 最も古いコマンドを取得
      const oldestCommand = Array.from(this.pendingCommands.entries())[0];
      if (oldestCommand) {
        commandId = oldestCommand[0];
      }
    }
    
    if (commandId && this.pendingCommands.has(commandId)) {
      const pending = this.pendingCommands.get(commandId)!;
      
      const response: ClaudeResponse = {
        success: parsedResponse.success,
        data: parsedResponse.data,
        error: parsedResponse.error || undefined,
        executionTime: Date.now() - pending.command.timestamp.getTime(),
        timestamp: new Date()
      };

      this.resolveCommand(commandId, response);
    } else {
      // 対応するコマンドが見つからない場合はログに記録
      this.log(LogLevel.WARN, `Received response without matching command: ${JSON.stringify(parsedResponse)}`);
    }
  }

  /**
   * コマンドタイムアウトを処理
   */
  private handleCommandTimeout(commandId: string): void {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      const timeoutError = new Error(`Command timeout after ${pending.command.timeout}ms`);
      
      if (pending.options.retryOnError && pending.retryCount < this.config.retryAttempts) {
        this.log(LogLevel.WARN, `Command ${commandId} timed out, retrying (${pending.retryCount + 1}/${this.config.retryAttempts})`);
        this.retryCommand(commandId);
      } else {
        this.log(LogLevel.ERROR, `Command ${commandId} timed out after ${pending.retryCount} retries`);
        this.rejectCommand(commandId, timeoutError);
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
      
      // メトリクス更新
      this.updateMetrics(pending, response, true);
      
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
      
      // メトリクス更新
      this.updateMetrics(pending, null, false, error);
      
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
      try {
        return JSON.parse(data);
      } catch (error) {
        throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (data === null || data === undefined) {
      throw new Error('Response data is null or undefined');
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
   * メトリクスを更新
   */
  private updateMetrics(
    pending: { queuedAt: Date; retryCount: number },
    response: ClaudeResponse | null,
    success: boolean,
    error?: Error
  ): void {
    const now = new Date();
    const queueWaitTime = now.getTime() - pending.queuedAt.getTime();
    
    // 基本メトリクス更新
    if (success && response) {
      this.metrics.successfulCommands++;
      this.metrics.totalExecutionTime += response.executionTime;
      this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.successfulCommands;
    } else {
      this.metrics.failedCommands++;
      
      if (error?.message.includes('timeout')) {
        this.metrics.timeoutCount++;
      }
    }
    
    // リトライ回数更新
    this.metrics.retryCount += pending.retryCount;
    
    // キュー待機時間更新
    this.metrics.queueWaitTime = (this.metrics.queueWaitTime + queueWaitTime) / 2; // 移動平均
    
    // 最後のコマンド時刻更新
    this.metrics.lastCommandTime = now;
  }

  /**
   * 通信メトリクスを取得
   */
  getMetrics(): CommunicationMetrics {
    return { ...this.metrics };
  }

  /**
   * メトリクスをリセット
   */
  resetMetrics(): void {
    this.metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      timeoutCount: 0,
      retryCount: 0,
      queueWaitTime: 0
    };
  }

  /**
   * 詳細な統計情報を取得
   */
  getDetailedStats() {
    const metrics = this.getMetrics();
    const status = this.getStatus();
    
    const successRate = metrics.totalCommands > 0 
      ? (metrics.successfulCommands / metrics.totalCommands) * 100 
      : 0;
    
    const timeoutRate = metrics.totalCommands > 0 
      ? (metrics.timeoutCount / metrics.totalCommands) * 100 
      : 0;
    
    const averageRetryCount = metrics.totalCommands > 0 
      ? metrics.retryCount / metrics.totalCommands 
      : 0;
    
    // 過去1分間のスループット計算
    const throughput = metrics.lastCommandTime 
      ? Math.min(metrics.totalCommands, 60) // 最大60コマンド/分として計算
      : 0;
    
    return {
      metrics,
      status,
      performance: {
        successRate,
        timeoutRate,
        averageRetryCount,
        throughput
      }
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    this.cancelAllCommands();
    this.removeAllListeners();
  }
}
/**
 * Claude Code CLI関連の型定義
 */

export enum ClaudeProcessStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  RESTARTING = 'RESTARTING'
}

export interface ClaudeProcessConfig {
  workspacePath: string;
  permissionMode?: 'bypassPermissions' | 'ask';
  printOutput?: boolean;
  timeout?: number;
  maxRetries?: number;
  restartDelay?: number;
}

export interface ClaudeProcessInfo {
  pid?: number | undefined;
  status: ClaudeProcessStatus;
  startTime?: Date | undefined;
  lastActivity?: Date | undefined;
  restartCount: number;
  errorCount: number;
}

export interface ClaudeResponse {
  success: boolean;
  data?: any;
  error?: string | undefined;
  executionTime: number;
  timestamp: Date;
}

export interface ClaudeCommand {
  id: string;
  prompt: string;
  timestamp: Date;
  timeout?: number;
}

export interface ClaudeProcessEvents {
  'status-change': (status: ClaudeProcessStatus) => void;
  'output': (data: string) => void;
  'error': (error: string) => void;
  'response': (response: ClaudeResponse) => void;
  'restart': (count: number) => void;
}
/**
 * Git Management System
 * 共有Gitリポジトリの管理、自動コミット、ブランチ管理を担当
 */

import { EventEmitter } from 'events';
import { ClaudeCommandExecutor } from '../claude/command-executor';
import { LogLevel, CodeChange } from '../models/types';

export interface GitManagerConfig {
  repositoryPath: string;
  defaultBranch?: string;
  autoCommit?: boolean;
  branchStrategy?: 'task-id' | 'feature' | 'simple';
}

export interface GitOperationResult {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
  files: string[];
}

export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  upstream?: string;
}

export class GitManager extends EventEmitter {
  private claudeExecutor: ClaudeCommandExecutor;
  private config: Required<GitManagerConfig>;
  private isInitialized: boolean = false;

  constructor(config: GitManagerConfig) {
    super();
    
    this.config = {
      repositoryPath: config.repositoryPath,
      defaultBranch: config.defaultBranch || 'main',
      autoCommit: config.autoCommit ?? true,
      branchStrategy: config.branchStrategy || 'task-id'
    };

    // ClaudeCommandExecutorの初期化（Git操作用）
    this.claudeExecutor = new ClaudeCommandExecutor({
      defaultWorkspacePath: this.config.repositoryPath,
      defaultTimeout: 30000 // Git操作は30秒でタイムアウト
    });
  }

  /**
   * Git Managerを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log(LogLevel.INFO, 'Initializing Git Manager');

      // Claude Code CLIの利用可能性確認
      const available = await this.claudeExecutor.checkAvailability();
      if (!available) {
        throw new Error('Claude Code CLI is not available');
      }

      // リポジトリの初期化または存在確認
      await this.initializeRepository();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.log(LogLevel.INFO, 'Git Manager initialized successfully');
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to initialize Git Manager: ${error}`);
      throw error;
    }
  }

  /**
   * 自動コミット実行
   */
  async autoCommit(taskId: string, codeChanges: CodeChange[], message?: string): Promise<GitOperationResult> {
    this.ensureInitialized();

    try {
      this.log(LogLevel.INFO, `Auto-committing changes for task: ${taskId}`);

      // ファイルの変更を検出
      const changedFiles = codeChanges.map(change => change.filePath);
      
      if (changedFiles.length === 0) {
        return {
          success: true,
          message: 'No files to commit',
          output: 'No changes detected'
        };
      }

      // Gitステータスを確認
      const statusResult = await this.getStatus();
      if (!statusResult.success) {
        throw new Error(`Failed to get git status: ${statusResult.error}`);
      }

      // ファイルをステージング
      const addResult = await this.addFiles(changedFiles);
      if (!addResult.success) {
        throw new Error(`Failed to stage files: ${addResult.error}`);
      }

      // コミットメッセージを構築
      const commitMessage = message || this.buildCommitMessage(taskId, codeChanges);

      // コミット実行
      const commitResult = await this.commit(commitMessage);
      
      if (commitResult.success) {
        this.emit('committed', { taskId, files: changedFiles, message: commitMessage });
      }

      return commitResult;

    } catch (error) {
      this.log(LogLevel.ERROR, `Auto-commit failed for task ${taskId}: ${error}`);
      return {
        success: false,
        message: 'Auto-commit failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * タスク用ブランチを作成
   */
  async createTaskBranch(taskId: string, fromBranch?: string): Promise<GitOperationResult> {
    this.ensureInitialized();

    try {
      const branchName = this.generateBranchName(taskId);
      const baseBranch = fromBranch || this.config.defaultBranch;

      this.log(LogLevel.INFO, `Creating branch: ${branchName} from ${baseBranch}`);

      // 基底ブランチにチェックアウト
      await this.checkout(baseBranch);

      // 最新の変更を取得
      await this.pull();

      // 新しいブランチを作成してチェックアウト
      const result = await this.executeGitCommand(`git checkout -b ${branchName}`);
      
      if (result.success) {
        this.emit('branch-created', { taskId, branchName, baseBranch });
      }

      return result;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to create branch for task ${taskId}: ${error}`);
      return {
        success: false,
        message: 'Branch creation failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * ブランチをマージ
   */
  async mergeBranch(sourceBranch: string, targetBranch?: string): Promise<GitOperationResult> {
    this.ensureInitialized();

    try {
      const target = targetBranch || this.config.defaultBranch;
      
      this.log(LogLevel.INFO, `Merging branch: ${sourceBranch} into ${target}`);

      // ターゲットブランチにチェックアウト
      await this.checkout(target);

      // 最新の変更を取得
      await this.pull();

      // マージ実行
      const result = await this.executeGitCommand(`git merge ${sourceBranch} --no-ff`);
      
      if (result.success) {
        this.emit('branch-merged', { sourceBranch, targetBranch: target });
        
        // マージ後にソースブランチを削除
        await this.executeGitCommand(`git branch -d ${sourceBranch}`);
      }

      return result;

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to merge branch ${sourceBranch}: ${error}`);
      return {
        success: false,
        message: 'Branch merge failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Gitステータスを取得
   */
  async getStatus(): Promise<GitOperationResult> {
    return this.executeGitCommand('git status --porcelain');
  }

  /**
   * ブランチ一覧を取得
   */
  async getBranches(): Promise<BranchInfo[]> {
    this.ensureInitialized();

    try {
      const result = await this.executeGitCommand('git branch -v');
      
      if (!result.success || !result.output) {
        return [];
      }

      return this.parseBranchOutput(result.output);

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to get branches: ${error}`);
      return [];
    }
  }

  /**
   * コミット履歴を取得
   */
  async getCommitHistory(limit: number = 10): Promise<CommitInfo[]> {
    this.ensureInitialized();

    try {
      const result = await this.executeGitCommand(
        `git log --oneline --name-only -${limit} --pretty=format:"%H|%s|%an|%ai"`
      );
      
      if (!result.success || !result.output) {
        return [];
      }

      return this.parseCommitOutput(result.output);

    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to get commit history: ${error}`);
      return [];
    }
  }

  /**
   * ファイルをステージング
   */
  async addFiles(files: string[]): Promise<GitOperationResult> {
    const fileList = files.join(' ');
    return this.executeGitCommand(`git add ${fileList}`);
  }

  /**
   * コミット実行
   */
  async commit(message: string): Promise<GitOperationResult> {
    return this.executeGitCommand(`git commit -m "${message}"`);
  }

  /**
   * ブランチをチェックアウト
   */
  async checkout(branchName: string): Promise<GitOperationResult> {
    return this.executeGitCommand(`git checkout ${branchName}`);
  }

  /**
   * 最新の変更を取得
   */
  async pull(): Promise<GitOperationResult> {
    return this.executeGitCommand('git pull');
  }

  /**
   * 変更をプッシュ
   */
  async push(branchName?: string): Promise<GitOperationResult> {
    const branch = branchName ? ` origin ${branchName}` : '';
    return this.executeGitCommand(`git push${branch}`);
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      this.log(LogLevel.INFO, 'Cleaning up Git Manager');

      await this.claudeExecutor.cleanup();
      this.removeAllListeners();

      this.isInitialized = false;
      this.log(LogLevel.INFO, 'Git Manager cleanup completed');
      
    } catch (error) {
      this.log(LogLevel.ERROR, `Error during Git Manager cleanup: ${error}`);
      throw error;
    }
  }

  /**
   * リポジトリの初期化または存在確認
   */
  private async initializeRepository(): Promise<void> {
    // .gitディレクトリの存在確認
    const checkResult = await this.executeGitCommand('git status');
    
    if (!checkResult.success) {
      // リポジトリが存在しない場合は初期化
      this.log(LogLevel.INFO, 'Initializing new Git repository');
      
      const initResult = await this.executeGitCommand('git init');
      if (!initResult.success) {
        throw new Error(`Failed to initialize git repository: ${initResult.error}`);
      }

      // 初期コミット用のREADMEを作成
      await this.executeGitCommand('echo "# Claude Company System" > README.md');
      await this.executeGitCommand('git add README.md');
      await this.executeGitCommand('git commit -m "🚀 Initial commit - Claude Company System"');
    }
  }

  /**
   * Gitコマンドを実行
   */
  private async executeGitCommand(command: string): Promise<GitOperationResult> {
    try {
      const prompt = `Execute the following git command in the repository:
      
Working Directory: ${this.config.repositoryPath}
Command: ${command}

Please execute this command and return the result. If there are any errors, include them in your response.`;

      const response = await this.claudeExecutor.sendPromptExpectJSON<{
        success: boolean;
        output?: string;
        error?: string;
        exitCode?: number;
      }>(prompt, {
        workspacePath: this.config.repositoryPath,
        allowedTools: ['Bash'],
        timeout: 30000
      });

      return {
        success: response.success && (response.exitCode === 0 || response.exitCode === undefined),
        message: response.success ? 'Command executed successfully' : 'Command failed',
        ...(response.output && { output: response.output }),
        ...(response.error && { error: response.error })
      };

    } catch (error) {
      return {
        success: false,
        message: 'Git command execution failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * コミットメッセージを構築
   */
  private buildCommitMessage(taskId: string, codeChanges: CodeChange[]): string {
    const actions = codeChanges.reduce((acc, change) => {
      acc[change.action] = (acc[change.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const actionSummary = Object.entries(actions)
      .map(([action, count]) => `${action.toLowerCase()}: ${count}`)
      .join(', ');

    return `feat(${taskId}): ${actionSummary} files

🤖 Generated by Claude Company System
- Task ID: ${taskId}
- Files modified: ${codeChanges.length}
- Changes: ${actionSummary}

Co-authored-by: Claude AI <claude@anthropic.com>`;
  }

  /**
   * ブランチ名を生成
   */
  private generateBranchName(taskId: string): string {
    const timestamp = Date.now().toString().slice(-6);
    
    switch (this.config.branchStrategy) {
      case 'task-id':
        return `task/${taskId}`;
      case 'feature':
        return `feature/${taskId}-${timestamp}`;
      case 'simple':
        return `dev-${taskId}`;
      default:
        return `task/${taskId}`;
    }
  }

  /**
   * ブランチ出力をパース
   */
  private parseBranchOutput(output: string): BranchInfo[] {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const current = line.startsWith('*');
        const parts = line.replace('*', '').trim().split(/\s+/);
        const name = parts[0];
        const commit = parts[1] || '';
        
        if (!name) {
          return null;
        }
        
        return {
          name,
          current,
          commit
        };
      })
      .filter((branch): branch is BranchInfo => branch !== null);
  }

  /**
   * コミット出力をパース
   */
  private parseCommitOutput(output: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    const lines = output.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line && line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          const [hash, message, author, timestamp] = parts;
          const files: string[] = [];
          
          // 次の行からファイル名を収集
          i++;
          while (i < lines.length) {
            const currentLine = lines[i];
            if (!currentLine || currentLine.includes('|')) {
              break;
            }
            const fileName = currentLine.trim();
            if (fileName) {
              files.push(fileName);
            }
            i++;
          }
          
          if (hash && message && author && timestamp) {
            commits.push({
              hash: hash.trim(),
              message: message.trim(),
              author: author.trim(),
              timestamp: new Date(timestamp.trim()),
              files
            });
          }
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    
    return commits;
  }

  /**
   * 初期化状態を確認
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Git Manager is not initialized. Call initialize() first.');
    }
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [GitManager] ${message}`);
  }
}
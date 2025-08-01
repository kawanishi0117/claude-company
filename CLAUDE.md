# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

階層型AI開発システム「Claude Company System」は、Boss AIが複数のSubordinate AIを管理してプロジェクト開発を自動化するシステムです。Windows Docker環境で動作し、タスクキューとRedisを使用した分散処理を行います。

## 開発コマンド

### テスト実行
```bash
npm test                # 全テスト実行
npm run test:watch      # ウォッチモード
npm run test:coverage   # カバレッジ付きテスト実行

# 単一テスト実行
jest src/claude/__tests__/communication-interface.test.ts
jest src/models/validation.test.ts
jest src/queue/task-queue.test.ts
```

### ビルドとチェック
```bash
npm run build          # TypeScriptコンパイル
npm run lint           # ESLintチェック
npm run format         # Prettierフォーマット
npm run dev            # 開発サーバー起動
```

### Docker環境
```bash
# システム起動（Windows）
.\start.ps1            # PowerShell
start.bat              # Command Prompt

# Docker操作
docker-compose up -d                              # バックグラウンド起動
docker-compose down                               # 停止
docker-compose logs -f                            # ログ監視
docker-compose up -d --scale subordinate-controller=5  # Subordinate AI数を調整

# サービス別ログ確認
docker-compose logs -f boss-controller
docker-compose logs -f subordinate-controller
docker-compose logs -f dashboard
```

## アーキテクチャ概要

### 主要コンポーネント
- **Boss AI Controller** (`src/controllers/boss-controller.ts`): ユーザー指示の処理、タスク分解、コードレビューを担当
- **Command Executor** (`src/claude/command-executor.ts`): Claude Code CLIコマンドの実行とレスポンス処理
- **Process Manager** (`src/claude/process-manager.ts`): Claude Code CLIプロセスのライフサイクル管理
- **Task Queue** (`src/queue/task-queue.ts`): Redis/Bullベースのタスクキューシステム
- **Data Models** (`src/models/`): 型定義とバリデーション

### Docker構成
- **boss-controller**: ポート8000、タスク管理とレビューを担当
- **subordinate-controller**: スケーラブル、実際の開発作業を実行
- **dashboard**: React製監視ダッシュボード（ポート3000）
- **redis**: タスクキュー（ポート6379）
- **elasticsearch + kibana**: ログ収集・可視化（ポート9200, 5601）

### Claude Code CLI統合
このプロジェクトではClaude Code CLIを`-p`オプションでコマンド実行モードで使用します：
- `claude -p "prompt" --output-format json`: JSONレスポンス取得
- `--permission-mode bypassPermissions`: Docker環境での権限バイパス
- `--mcp-config`: MCPサーバー設定ファイルの指定
- `--add-dir`: ワークスペースディレクトリの指定

### データフロー
1. ユーザー指示 → Boss AI → タスク分解
2. タスク → Task Queue → Subordinate AI割り当て
3. 実装結果 → Boss AI → コードレビュー
4. 統合テスト → 結果報告

## 重要な型定義

### Task関連 (`src/models/types.ts`)
- `Task`: タスクの基本構造（id, title, description, priority, dependencies, status）
- `TaskStatus`: PENDING | IN_PROGRESS | COMPLETED | FAILED | CANCELLED
- `WorkResult`: 部下AIの作業結果（codeChanges, testResults, completionTime）
- `AgentType`: BOSS | SUBORDINATE
- `LogLevel`: DEBUG | INFO | WARN | ERROR

### Queue関連 (`src/queue/types.ts`)
- `TaskJob`: キューのジョブ構造（task, priority, attempts, assignedTo）
- `QueueName`: TASK_QUEUE | RESULT_QUEUE | PRIORITY_QUEUE
- `JobStatus`: waiting | active | completed | failed | delayed | paused

### Claude関連 (`src/claude/types.ts`)
- `ClaudeProcessStatus`: STOPPED | STARTING | RUNNING | ERROR | RESTARTING
- `ClaudeResponse`: 通信レスポンス構造（success, data, error, executionTime）
- `ClaudeCommand`: コマンド送信用（id, prompt, timestamp）

### CommandExecutor関連 (`src/claude/command-executor.ts`)
- `ClaudeCommandOptions`: outputFormat, mcpConfig, workspacePath, permissionMode等
- `ClaudeCommandResult`: success, result, error, duration, cost, usage

## 開発時の注意点

### バリデーション
- 全てのTask, WorkResultオブジェクトは`validateTask()`, `validateWorkResult()`でバリデーション必須
- 型定義に厳密に従い、追加プロパティは慎重に検討

### エラーハンドリング
- Boss Controllerは`LogLevel`を使用したログ出力
- 非同期処理は必ずtry-catchでエラーハンドリング
- ClaudeCommandExecutorでのタイムアウトとリトライ処理に注意

### テスト作成
- `__tests__`ディレクトリにJestテストを配置
- ClaudeCommandExecutorはモック化して単体テスト
- 統合テストは実際のClaude Code CLIを使用

### 環境設定
- `.env`ファイルでANTHROPIC_API_KEY設定必須
- Redis接続設定は`src/queue/config.ts`で管理
- Docker環境変数は`docker-compose.yml`で定義
- MCP設定は各コンテナの`mcp-config.json`で管理

## アクセスポイント
- Dashboard: http://localhost:3000
- API: http://localhost:8000  
- Kibana: http://localhost:5601
- Redis: localhost:6379
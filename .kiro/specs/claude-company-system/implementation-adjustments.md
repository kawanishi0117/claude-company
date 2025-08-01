# 実装仕様調整書

## 調査結果に基づく仕様変更

### 1. Claude Code CLI制御方式の変更

**従来の仕様:**
- stdin/stdoutを使ったプロセス管理
- 永続化されたClaude セッション

**調整後の仕様:**
- コマンド実行ベースのアプローチ
- `claude -p "prompt" --output-format json`でワンショット実行
- `--dangerously-skip-permissions`でDocker環境対応

**理由:**
- 実際のClaude Code CLIは対話型REPLがメインで、プログラマティック制御は`-p`オプションが適している
- Docker環境では権限管理が課題となるため、sandboxed環境では権限バイパスが実用的
- JSONレスポンスにより構造化データの取得が確実

### 2. MCP統合の具体化

**従来の仕様:**
- 抽象的なMCP利用の記述

**調整後の仕様:**
- `--mcp-config`でJSONファイルベースの設定
- ファイルシステム操作: `@modelcontextprotocol/server-filesystem`
- Git操作: `@modelcontextprotocol/server-github` (非推奨だが代替あり)
- 設定例:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
}
```

### 3. Docker Compose環境の調整

**Boss AI Container:**
```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @anthropic-api/claude-code @modelcontextprotocol/server-filesystem
COPY claude-config.json /app/
COPY mcp-config.json /app/
WORKDIR /workspace
```

**環境変数:**
- `ANTHROPIC_API_KEY`: Claude API認証
- `CLAUDE_CONFIG_PATH=/app/claude-config.json`
- `MCP_CONFIG_PATH=/app/mcp-config.json`

### 4. 実装アーキテクチャの修正

**ClaudeProcessManager → ClaudeCommandExecutor**
```typescript
interface ClaudeCommandExecutor {
  executeCommand(prompt: string, options: {
    outputFormat?: 'json' | 'text';
    mcpConfig?: string;
    workspacePath?: string;
    allowedTools?: string[];
  }): Promise<ClaudeResponse>;
}
```

**CommunicationInterface → CommandInterface**
```typescript
interface CommandInterface {
  sendPrompt(prompt: string): Promise<any>;
  sendPromptExpectJSON<T>(prompt: string): Promise<T>;
  executeBatch(prompts: string[]): Promise<any[]>;
}
```

### 5. BossController / SubordinateController統一化

**共通基底クラス:**
```typescript
abstract class BaseAIController {
  protected claudeExecutor: ClaudeCommandExecutor;
  protected workspacePath: string;
  protected mcpConfigPath: string;
  
  protected async executeTask(prompt: string): Promise<any> {
    return await this.claudeExecutor.executeCommand(prompt, {
      outputFormat: 'json',
      mcpConfig: this.mcpConfigPath,
      workspacePath: this.workspacePath
    });
  }
}

class BossController extends BaseAIController {
  // タスク分解、レビュー、統合テスト機能
}

class SubordinateController extends BaseAIController {
  // タスク実行、単体テスト機能
}
```

### 6. Git統合の簡素化

**従来:**
- 複雑なGit操作の自動化

**調整後:**
- MCPのGitサーバーまたはシンプルなGitコマンド実行
- Boss AIによるコミット/マージの管理
- コンフリクト時のマニュアル介入

### 7. テスト戦略の調整

**ユニットテスト:**
- ClaudeCommandExecutorのモック化
- JSON レスポンスの解析テスト

**統合テスト:**
- 実際のClaude Code CLIを使用
- Docker Compose環境でのE2Eテスト
- MCP統合の動作確認

### 8. エラーハンドリングの改善

**Claude Code CLI固有:**
- API認証エラー
- コマンドタイムアウト
- JSONパースエラー
- MCP権限エラー

**Docker固有:**
- ボリュームマウントエラー
- ネットワーク接続エラー
- リソース不足エラー

この調整により、実際のClaude Code CLIの動作に基づいた、より現実的で実装可能なシステム設計となります。
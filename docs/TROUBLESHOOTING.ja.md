# Claude Company System - トラブルシューティングガイド

よくある問題とその解決方法の包括的なトラブルシューティングガイドです。

## 目次
1. [システム診断](#システム診断)
2. [起動時の問題](#起動時の問題)
3. [実行時の問題](#実行時の問題)
4. [パフォーマンスの問題](#パフォーマンスの問題)
5. [ネットワークの問題](#ネットワークの問題)
6. [APIと認証](#apiと認証)
7. [Dockerの問題](#dockerの問題)
8. [ログ分析](#ログ分析)
9. [復旧手順](#復旧手順)

## システム診断

### クイックヘルスチェック
システムステータスモニターを実行して概要を取得：
```powershell
.\status.ps1
```

### 詳細システム情報
```powershell
# リソース使用量を含む包括的なステータス
.\status.ps1 -Detailed

# 継続的な監視
.\status.ps1 -Continuous

# 自動化用のJSON出力
.\status.ps1 -Json
```

### 手動ヘルスチェック
```powershell
# Dockerステータスを確認
docker info
docker-compose ps

# サービスエンドポイントを確認
curl http://localhost:3000  # ダッシュボード
curl http://localhost:8000/health  # API
curl http://localhost:9200  # Elasticsearch
curl http://localhost:5601  # Kibana

# Redisを確認
docker-compose exec redis redis-cli ping
```

## 起動時の問題

### 問題: Docker Desktopが起動しない
**エラー**: "Docker daemon is not running"

**診断**:
```powershell
# Dockerサービスステータスを確認
Get-Service com.docker.service
```

**解決方法**:
1. **Docker Desktopを再起動**:
   ```powershell
   # Docker Desktopを終了
   Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
   
   # Docker Desktopを起動
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   ```

2. **Dockerサービスを再起動**:
   ```powershell
   Restart-Service com.docker.service
   ```

3. **Dockerを工場出荷時設定にリセット**:
   - Docker Desktopを開く
   - 設定 → トラブルシューティング → 工場出荷時設定にリセット

4. **Windows機能を確認**:
   ```powershell
   # 必要なWindows機能を有効化
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
   ```

### 問題: 環境設定エラー
**エラー**: "Invalid ANTHROPIC_API_KEY"

**診断**:
```powershell
# .envファイルの内容を確認
Get-Content .env | Select-String "ANTHROPIC_API_KEY"
```

**解決方法**:
1. **APIキー形式を確認**:
   - `sk-ant-`で始まる必要があります
   - 64文字以上である必要があります
   - 余分なスペースや引用符がないこと

2. **APIキーをテスト**:
   ```powershell
   $apiKey = "your-api-key-here"
   $headers = @{
       "x-api-key" = $apiKey
       "Content-Type" = "application/json"
   }
   $body = @{
       model = "claude-3-5-sonnet-20241022"
       max_tokens = 10
       messages = @(@{
           role = "user"
           content = "Hello"
       })
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" -Method POST -Headers $headers -Body $body
   ```

### 問題: ポート競合
**エラー**: "Port 3000 is already in use"

**診断**:
```powershell
# ポートを使用しているプロセスを確認
netstat -ano | findstr :3000
Get-Process -Id <PID>
```

**解決方法**:
1. **競合するサービスを停止**:
   ```powershell
   Stop-Process -Id <PID>
   ```

2. **ポートを変更**:
   `docker-compose.yml`を編集：
   ```yaml
   services:
     dashboard:
       ports:
         - "3001:3000"
   ```

3. **ポートマッピングスクリプトを使用**:
   ```powershell
   # 利用可能なポートを確認
   $ports = 3000..3010
   foreach ($port in $ports) {
       $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
       if (-not $conn.TcpTestSucceeded) {
           Write-Host "Port $port is available"
           break
       }
   }
   ```

### 問題: システムリソース不足
**エラー**: "Not enough memory" またはコンテナが強制終了される

**診断**:
```powershell
# システムリソースを確認
Get-WmiObject -Class Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
docker system df
docker stats --no-stream
```

**解決方法**:
1. **Dockerメモリを増やす**:
   - Docker Desktop → 設定 → リソース → メモリ
   - 最低4GB、できれば8GB以上を割り当て

2. **Elasticsearchメモリを削減**:
   ```env
   ES_JAVA_OPTS=-Xms256m -Xmx256m
   ```

3. **Subordinateレプリカを削減**:
   ```env
   SUBORDINATE_REPLICAS=1
   ```

## 実行時の問題

### 問題: AIエージェントが応答しない
**症状**: エージェントがアイドル状態、タスクが処理されない

**診断**:
```powershell
# エージェントコンテナログを確認
docker-compose logs boss-controller
docker-compose logs subordinate-controller

# タスクキューを確認
docker-compose exec redis redis-cli LLEN task_queue
```

**解決方法**:
1. **エージェントサービスを再起動**:
   ```powershell
   docker-compose restart boss-controller subordinate-controller
   ```

2. **Claude API接続を確認**:
   ```powershell
   # コンテナ内からテスト
   docker-compose exec boss-controller curl -I https://api.anthropic.com
   ```

3. **環境変数を確認**:
   ```powershell
   docker-compose exec boss-controller env | grep ANTHROPIC
   ```

### 問題: WebSocket接続失敗
**症状**: ダッシュボードに「サーバーから切断されました」と表示

**診断**:
```powershell
# WebSocketエンドポイントを確認
curl -H "Upgrade: websocket" http://localhost:8000/ws

# ダッシュボードログを確認
docker-compose logs dashboard
```

**解決方法**:
1. **ダッシュボードサービスを再起動**:
   ```powershell
   docker-compose restart dashboard
   ```

2. **プロキシ設定を確認**:
   - localhostに対する企業プロキシを無効化
   - localhostをプロキシバイパスリストに追加

3. **ブラウザの問題**:
   - ブラウザキャッシュをクリア
   - ブラウザ拡張機能を無効化
   - シークレットモードを試す

### 問題: データベース接続エラー
**症状**: "Redis connection failed"

**診断**:
```powershell
# Redis接続をテスト
docker-compose exec redis redis-cli ping
docker-compose exec boss-controller redis-cli -h redis ping
```

**解決方法**:
1. **Redisを再起動**:
   ```powershell
   docker-compose restart redis
   ```

2. **Redis設定を確認**:
   ```powershell
   docker-compose exec redis redis-cli CONFIG GET "*"
   ```

3. **ネットワーク接続**:
   ```powershell
   # コンテナ間のネットワーク接続をテスト
   docker-compose exec boss-controller ping redis
   ```

## パフォーマンスの問題

### 問題: 応答時間が遅い
**症状**: タスク処理の長い遅延、UIの遅延

**診断**:
```powershell
# リソース使用量を確認
docker stats --no-stream

# API応答時間を確認
Measure-Command { curl http://localhost:8000/health }

# システムパフォーマンスを確認
Get-Counter "\Processor(_Total)\% Processor Time"
```

**解決方法**:
1. **リソースをスケール**:
   ```powershell
   # subordinateレプリカを増やす
   docker-compose up -d --scale subordinate-controller=5
   ```

2. **メモリを最適化**:
   ```env
   # Elasticsearchメモリを増やす
   ES_JAVA_OPTS=-Xms1g -Xmx1g
   ```

3. **データベース最適化**:
   ```powershell
   # 必要に応じてRedisをクリア
   docker-compose exec redis redis-cli FLUSHDB
   ```

### 問題: 高CPU使用率
**症状**: システムが応答しなくなる、ファンが回転する

**診断**:
```powershell
# どのコンテナがCPUを使用しているかを確認
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# ホストCPU使用量を確認
Get-Process | Sort CPU -Descending | Select -First 10
```

**解決方法**:
1. **コンテナリソースを制限**:
   ```yaml
   services:
     subordinate-controller:
       deploy:
         resources:
           limits:
             cpus: "0.5"
   ```

2. **同時タスクを削減**:
   ```env
   SUBORDINATE_REPLICAS=2
   ```

## ネットワークの問題

### 問題: 外部API呼び出しが失敗する
**症状**: api.anthropic.comへの「接続タイムアウト」

**診断**:
```powershell
# ホストから接続をテスト
curl -I https://api.anthropic.com

# コンテナからテスト
docker-compose exec boss-controller curl -I https://api.anthropic.com

# DNS解決を確認
nslookup api.anthropic.com
```

**解決方法**:
1. **ファイアウォールを確認**:
   ```powershell
   # テスト用にWindowsファイアウォールを一時的に無効化
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   ```

2. **企業プロキシ**:
   ```yaml
   services:
     boss-controller:
       environment:
         - HTTP_PROXY=http://proxy.company.com:8080
         - HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **DNS問題**:
   ```yaml
   services:
     boss-controller:
       dns:
         - 8.8.8.8
         - 1.1.1.1
   ```

### 問題: コンテナ間通信
**症状**: サービス同士が到達できない

**診断**:
```powershell
# Dockerネットワークを確認
docker network ls
docker network inspect claude-company-system_default

# 接続をテスト
docker-compose exec boss-controller ping redis
docker-compose exec dashboard ping boss-controller
```

**解決方法**:
1. **ネットワークを再作成**:
   ```powershell
   docker-compose down
   docker network prune -f
   docker-compose up -d
   ```

2. **サービス名を確認**:
   サービスがdocker-compose.ymlで定義された正しいホスト名を使用していることを確認

## APIと認証

### 問題: 認証失敗
**症状**: 401 Unauthorizedレスポンス

**診断**:
```powershell
# ログでAPIキーを確認（マスク済み）
docker-compose logs boss-controller | Select-String "auth"

# APIキー形式を確認
$env:ANTHROPIC_API_KEY -match "^sk-ant-"
```

**解決方法**:
1. **APIキーを再生成**:
   - https://console.anthropic.com/ にアクセス
   - 新しいAPIキーを作成
   - .envファイルを更新

2. **アカウントステータスを確認**:
   - アカウントに十分なクレジットがあることを確認
   - API使用制限を確認

### 問題: レート制限
**症状**: "Rate limit exceeded" エラー

**診断**:
```powershell
# ログでレート制限ヘッダーを確認
docker-compose logs boss-controller | Select-String "rate.limit"
```

**解決方法**:
1. **バックオフを実装**:
   ```env
   # 同時リクエストを削減
   SUBORDINATE_REPLICAS=1
   ```

2. **プランをアップグレード**:
   - 制限増加のため上位プランを検討

## Dockerの問題

### 問題: コンテナビルド失敗
**症状**: 起動時に「Build failed」

**診断**:
```powershell
# 詳細出力でビルド
docker-compose build --no-cache --progress=plain
```

**解決方法**:
1. **ビルドキャッシュをクリア**:
   ```powershell
   docker builder prune -f
   docker-compose build --no-cache
   ```

2. **Dockerfile構文を確認**:
   - Dockerfile構文を確認
   - ベースイメージの可用性を確認

### 問題: ボリュームマウントの問題
**症状**: ファイルが永続化されない、権限エラー

**診断**:
```powershell
# ボリュームマウントを確認
docker-compose config | Select-String -A5 -B5 "volumes"

# ファイル権限を確認
docker-compose exec boss-controller ls -la /workspace
```

**解決方法**:
1. **ボリュームをリセット**:
   ```powershell
   docker-compose down -v
   docker volume prune -f
   docker-compose up -d
   ```

2. **権限を修正**:
   ```powershell
   # コンテナから
   docker-compose exec boss-controller chown -R node:node /workspace
   ```

## ログ分析

### 集中ログ
複数の方法でログにアクセス：

```powershell
# 全サービス
docker-compose logs -f

# 特定のサービス
docker-compose logs -f boss-controller

# フィルタされたログ
docker-compose logs | Select-String "ERROR"

# ログをエクスポート
docker-compose logs > system-logs.txt
```

### Kibanaダッシュボード
http://localhost:5601 でKibanaにアクセスして以下を利用：
- リアルタイムログストリーミング
- 高度なフィルタリングと検索
- ログ分析と可視化

### よくあるログパターン
ログで以下のパターンを探してください：

**成功した操作**:
```
✓ Task completed successfully
✓ WebSocket connection established
✓ Health check passed
```

**警告**:
```
⚠ High memory usage detected
⚠ API rate limit approaching
⚠ Connection retry attempt
```

**エラー**:
```
✗ API authentication failed
✗ Database connection lost
✗ Container health check failed
```

## 復旧手順

### 完全システムリセット
他の方法が失敗した場合：

```powershell
# 完全システムリセット
docker-compose down -v
docker system prune -af
docker volume prune -f

# 全コンテナとイメージを削除
docker container prune -f
docker image prune -af

# 最初から再起動
.\start-enhanced.ps1 --no-cache
```

### データ復旧
```powershell
# 現在の状態をバックアップ
docker-compose exec redis redis-cli BGSAVE

# データをエクスポート
mkdir backup
docker-compose exec elasticsearch curl -X GET "localhost:9200/_all/_search" > backup/elasticsearch-data.json

# バックアップから復元
docker-compose exec redis redis-cli FLUSHDB
docker-compose exec redis redis-cli < backup/redis-backup.rdb
```

### 設定リセット
```powershell
# デフォルト設定にリセット
Copy-Item .env.example .env
Copy-Item config/claude-config-template.json config/claude-config.json

# 値を編集
notepad .env
notepad config/claude-config.json
```

## 緊急連絡先

### システムステータス
- **ヘルスダッシュボード**: http://localhost:3000
- **APIステータス**: http://localhost:8000/health
- **監視**: `.\status.ps1 -Continuous`

### サポートリソース
- **ドキュメント**: docs/フォルダ
- **GitHub Issues**: プロジェクトリポジトリのissuesページ
- **コミュニティフォーラム**: [コミュニティフォーラムへのリンク]
- **エンタープライズサポート**: [エンタープライズサポート連絡先]

---

**注意**: 復旧手順を実行する前に、必ずデータをバックアップしてください。問題を報告する際は、診断セクションから関連するログとシステム情報を含めてください。

---

## 言語選択 / Language Selection

- [English](TROUBLESHOOTING.md)
- [日本語](TROUBLESHOOTING.ja.md) ← 現在のページ
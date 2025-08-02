# Claude Company System - セットアップガイド

Windows環境でのClaude Company Systemの完全なセットアップ手順です。

## 目次
1. [前提条件](#前提条件)
2. [システム要件](#システム要件)
3. [インストール](#インストール)
4. [設定](#設定)
5. [初回起動](#初回起動)
6. [動作確認](#動作確認)
7. [トラブルシューティング](#トラブルシューティング)

## 前提条件

### 必要なソフトウェア
- **Windows 10/11**（64ビット）
- **Docker Desktop**（最新版）
  - ダウンロード: https://www.docker.com/products/docker-desktop
  - Dockerに最低4GBのRAMを割り当て
- **PowerShell 5.1以上**（Windowsに含まれています）
- **Git**（ソースコード管理用）
  - ダウンロード: https://git-scm.com/download/win

### 必要なサービス
- **Anthropic Claude API**（$100以上のプランが必要）
  - サインアップ: https://console.anthropic.com/
  - 適切な権限でAPIキーを生成
- **インターネット接続**（DockerイメージのダウンロードとAPI呼び出し用）

### オプション（推奨）
- **Visual Studio Code**（設定ファイル編集用）
- **Windows Terminal**（より良いPowerShell体験のため）

## システム要件

### 最小要件
- **CPU**: 4コア、2.5GHz以上
- **RAM**: 8GB（Docker用4GB、システム用4GB）
- **ストレージ**: 20GB以上の空き容量
- **ネットワーク**: ブロードバンドインターネット（API呼び出し用）

### 推奨要件
- **CPU**: 8コア以上、3.0GHz以上
- **RAM**: 16GB以上（Docker用8GB、システム用8GB）
- **ストレージ**: 50GB以上のSSDストレージ
- **ネットワーク**: 低遅延の高速インターネット

### Dockerリソース
Docker Desktopを以下の最小リソースで設定してください：
- **メモリ**: 4GB
- **CPU**: 4コア
- **ディスク**: 20GB

## インストール

### ステップ1: リポジトリのクローン
```bash
git clone https://github.com/your-org/claude-company-system.git
cd claude-company-system
```

### ステップ2: Dockerインストールの確認
```powershell
# Dockerが動作していることを確認
docker --version
docker-compose --version

# Docker機能をテスト
docker run hello-world
```

### ステップ3: 必要なイメージのダウンロード（オプション）
```powershell
# 初回起動を高速化するためにイメージを事前ダウンロード
docker-compose pull
```

## 設定

### ステップ1: 環境設定
1. サンプル環境ファイルをコピー：
   ```powershell
   Copy-Item .env.example .env
   ```

2. `.env`ファイルを設定で編集：
   ```env
   # 必須: Claude APIキー
   ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   
   # システム設定
   SUBORDINATE_REPLICAS=3        # AIワーカーの数
   LOG_LEVEL=info               # debug, info, warn, error
   NODE_ENV=production          # production または development
   
   # セキュリティ
   REDIS_PASSWORD=your-secure-password-here
   
   # パフォーマンス調整
   ES_JAVA_OPTS=-Xms512m -Xmx512m  # Elasticsearchメモリ
   ```

### ステップ2: Claude Code CLI設定
1. 設定テンプレートをコピー：
   ```powershell
   Copy-Item config/claude-config-template.json config/claude-config.json
   ```

2. 環境に合わせて設定をカスタマイズ：
   - モデル設定とタイムアウトを調整
   - ワークスペースパスを設定
   - 統合機能を設定

### ステップ3: リソース割り当て
システムスペックに基づいて、`docker-compose.yml`でリソース割り当てを調整：

8GB RAMシステムの場合：
```yaml
services:
  elasticsearch:
    environment:
      - "ES_JAVA_OPTS=-Xms256m -Xmx256m"
```

16GB以上RAMシステムの場合：
```yaml
services:
  elasticsearch:
    environment:
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
```

## 初回起動

### オプション1: 拡張スクリプト（推奨）
完全なヘルスチェック付きの拡張起動スクリプトを使用：

```powershell
# 基本起動
.\start-enhanced.ps1

# デバッグログ付き開発モード
.\start-enhanced.ps1 -Development

# AIワーカー数をカスタマイズ
.\start-enhanced.ps1 -Replicas 5

# 高速起動のためヘルスチェックをスキップ
.\start-enhanced.ps1 -SkipHealthCheck
```

### オプション2: 基本スクリプト
高度な機能なしのシンプルな起動：

```powershell
.\start.ps1
```

### オプション3: 手動Docker Compose
完全な制御が必要な上級ユーザー向け：

```powershell
# まずコアサービスを起動
docker-compose up -d redis elasticsearch

# コアサービスの初期化を待機
Start-Sleep -Seconds 30

# アプリケーションサービスを起動
docker-compose up -d --scale subordinate-controller=3
```

## 動作確認

### システムヘルスチェック
起動後、システムが正常に動作していることを確認：

```powershell
# ステータスモニターを実行
.\status.ps1

# または個別サービスを確認
docker-compose ps
docker-compose logs -f --tail 100
```

### アクセスポイント
動作中は以下のエンドポイントにアクセスできます：

- **メインダッシュボード**: http://localhost:3000
- **APIエンドポイント**: http://localhost:8000
- **ヘルスチェック**: http://localhost:8000/health
- **Kibana（ログ）**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

### AI機能のテスト
1. http://localhost:3000 でダッシュボードを開く
2. 指示送信フォームに移動
3. シンプルなテスト指示を送信：「シンプルな'Hello World' JavaScript関数を作成してください」
4. エージェントパネルでアクティビティを監視
5. ログで正常な処理を確認

## トラブルシューティング

### よくある問題

#### Dockerが起動しない
**症状**: "Docker daemon is not running" エラー
**解決方法**:
1. Docker Desktopを手動で起動
2. Docker Desktopサービスを再起動：
   ```powershell
   Restart-Service com.docker.service
   ```
3. Docker Desktopを工場出荷時設定にリセット
4. Windows仮想化が有効になっていることを確認（Hyper-V/WSL2）

#### APIキーの問題
**症状**: 認証エラー、401レスポンス
**解決方法**:
1. APIキー形式が`sk-ant-`で始まることを確認
2. APIキーに十分なクレジットがあることを確認
3. APIキーに適切な権限があることを確認
4. curlでAPIキーをテスト：
   ```powershell
   curl -X POST https://api.anthropic.com/v1/messages `
     -H "x-api-key: your-api-key" `
     -H "Content-Type: application/json" `
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hello"}]}'
   ```

#### ポート競合
**症状**: "Port already in use" エラー
**解決方法**:
1. ポートを使用しているプロセスを確認：
   ```powershell
   netstat -ano | findstr :3000
   netstat -ano | findstr :8000
   ```
2. 競合するサービスを停止するか、docker-compose.ymlでポートを変更
3. 異なるポートを使用：
   ```yaml
   ports:
     - "3001:3000"  # ダッシュボードをポート3001で
     - "8001:8000"  # APIをポート8001で
   ```

#### メモリ不足
**症状**: コンテナが強制終了される、メモリ不足エラー
**解決方法**:
1. Docker Desktopのメモリ割り当てを増やす
2. .envでElasticsearchメモリを削減：
   ```env
   ES_JAVA_OPTS=-Xms256m -Xmx256m
   ```
3. subordinateレプリカ数を削減：
   ```env
   SUBORDINATE_REPLICAS=1
   ```

#### ネットワーク接続
**症状**: サービス間通信不可、APIタイムアウト
**解決方法**:
1. Windowsファイアウォール設定を確認
2. Dockerネットワーク設定を確認：
   ```powershell
   docker network ls
   docker network inspect claude-company-system_default
   ```
3. Dockerネットワークを再起動：
   ```powershell
   docker-compose down
   docker system prune -f
   docker-compose up -d
   ```

### パフォーマンス最適化

#### 開発環境用
```env
NODE_ENV=development
LOG_LEVEL=debug
SUBORDINATE_REPLICAS=1
ES_JAVA_OPTS=-Xms256m -Xmx256m
```

#### 本番環境用
```env
NODE_ENV=production
LOG_LEVEL=info
SUBORDINATE_REPLICAS=5
ES_JAVA_OPTS=-Xms1g -Xmx1g
```

### ログ分析
問題の確認のため、異なるログソースをチェック：

```powershell
# システムログ
.\status.ps1 -Detailed

# コンテナログ
docker-compose logs boss-controller
docker-compose logs subordinate-controller
docker-compose logs dashboard

# アプリケーションログ
docker-compose exec boss-controller cat logs/app.log
```

### サポートを受ける

1. **ドキュメントを確認**: README.mdとdocs/フォルダを確認
2. **システムステータス**: リアルタイム診断のため`.\status.ps1`を実行
3. **ログ**: `docker-compose logs -f`でログを確認
4. **ヘルスエンドポイント**: http://localhost:8000/health を確認
5. **コミュニティサポート**: プロジェクトリポジトリに問題を報告

### 高度な設定

#### カスタムDocker Compose
本番デプロイメント用に、カスタム`docker-compose.override.yml`を作成：

```yaml
version: '3.8'
services:
  boss-controller:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
  
  elasticsearch:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    environment:
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
```

#### 環境固有の設定
環境別ファイルを維持：
- `.env.development`
- `.env.staging`  
- `.env.production`

起動前に適切なものを`.env`にコピーしてください。

## 次のステップ

セットアップ成功後：
1. 使用方法については[ユーザーガイド](USER_GUIDE.ja.md)を確認
2. 統合の詳細については[APIドキュメント](API.ja.md)を確認
3. カスタマイズについては[高度な設定](ADVANCED.ja.md)を確認
4. 本番デプロイメント用の[監視](MONITORING.ja.md)を設定

---

追加サポートについては、トラブルシューティングセクションを参照するか、開発チームにお問い合わせください。

---

## 言語選択 / Language Selection

- [English](SETUP.md)
- [日本語](SETUP.ja.md) ← 現在のページ
# Claude Company System

階層型AI開発システムで、AI同士の協調によってプロジェクト開発を自動化します。このシステムはWindows Docker環境で動作し、Boss AIが複数のSubordinate AIを管理して開発タスクを実行します。

## クイックスタート

### 前提条件

- Windows 10/11 with Docker Desktop
- Claude API Key（$100プランが必要）
- 8GB以上のRAM推奨
- 4コア以上のCPU推奨

### インストール

1. このリポジトリをクローンします
2. `.env.example`を`.env`にコピーし、`ANTHROPIC_API_KEY`を設定します
3. 起動スクリプトを実行します：

**PowerShell:**
```powershell
.\start.ps1
```

**コマンドプロンプト:**
```cmd
start.bat
```

### アクセスポイント

- **ダッシュボード**: http://localhost:3000
- **API**: http://localhost:8000
- **Kibana（ログ）**: http://localhost:5601
- **Redis**: localhost:6379

## アーキテクチャ

システムは以下の要素で構成されています：

- **Boss AIコンテナ**: タスク管理、コードレビュー、統合テストの実行
- **Subordinate AIコンテナ**: 開発タスクの実行と単体テストの実行
- **Webダッシュボード**: React製の監視インターフェース
- **タスクキュー**: Redisベースのタスク配布システム
- **ログ集約**: Elasticsearch + Kibanaによる監視

## 使用方法

1. http://localhost:3000 でダッシュボードにアクセス
2. 入力フィールドに開発指示を入力
3. AIエージェントの進捗をリアルタイムで監視
4. ログとパフォーマンスメトリクスを確認

## 開発

### プロジェクト構造

```
claude-company-system/
├── src/                    # コアアプリケーションソース
├── dashboard/              # React Webダッシュボード
├── docker/                 # Docker設定
├── logs/                   # ログファイル
├── tests/                  # テストファイル
├── docker-compose.yml      # メインDocker設定
└── start.ps1/start.bat     # 起動スクリプト
```

### コマンド

```bash
# ログを表示
docker-compose logs -f

# システムを停止
docker-compose down

# コンテナを再ビルド
docker-compose build --no-cache

# Subordinate AIをスケール
docker-compose up -d --scale subordinate-controller=5
```

## 設定

`.env`の環境変数：

- `ANTHROPIC_API_KEY`: Claude APIキー（必須）
- `SUBORDINATE_REPLICAS`: Subordinate AIの数（デフォルト: 3）
- `LOG_LEVEL`: ログレベル（デフォルト: info）

## トラブルシューティング

### よくある問題

1. **Dockerが動作していない**: Docker Desktopを起動してください
2. **APIキーが無効**: `.env`のClaude APIキーを確認してください
3. **ポート競合**: ポート3000、8000、5601、6379、9200が利用可能であることを確認してください
4. **メモリ不足**: Dockerのメモリ割り当てを8GB以上に増やしてください

### ログ

サービス固有のログを表示：
```bash
docker-compose logs -f boss-controller
docker-compose logs -f subordinate-controller
docker-compose logs -f dashboard
```

## ライセンス

MIT License - 詳細はLICENSEファイルを参照してください

---

## 言語選択 / Language Selection

- [English](README.md)
- [日本語](README.ja.md) ← 現在のページ
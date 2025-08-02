# Claude Company セットアップ手順

## 自動セットアップ（推奨）

Windows 10/11で管理者権限のPowerShellを開いて実行：

```powershell
# setup/windowsディレクトリに移動
cd C:\pg\claude-company\setup\windows

# 自動セットアップスクリプトを実行
.\run.ps1
```

このスクリプトは以下を自動で行います：
- WSL2の有効化とインストール
- Ubuntuディストリビューションのインストール  
- Docker Engineのインストール
- 設定の最適化と検証

## Claude Companyを起動

セットアップ完了後：

```bash
# プロジェクトディレクトリに移動
cd /mnt/c/pg/claude-company

# Docker Composeで起動
docker-compose up -d

# 状態を確認
docker-compose ps
```

## アクセスポイント
- ダッシュボード: http://localhost:3000
- API: http://localhost:8000
- Kibana: http://localhost:5601

## 便利なコマンド

```bash
# ログを見る
docker-compose logs -f

# 特定サービスのログ
docker-compose logs -f boss-controller

# システムを停止
docker-compose down

# システムを再起動
docker-compose restart
```
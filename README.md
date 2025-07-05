# 家計簿アプリケーション

レシート画像から情報を抽出し、データベースに保存して管理する家計簿アプリケーションです。

## 機能

- レシート画像から店舗名と合計金額を抽出
- 抽出した情報をSQLiteデータベースに保存
- 月次レポートの生成と表示
- 月次レポートをメールで送信
- Webブラウザでの表示と管理

## プロジェクト構成

このプロジェクトはmonorepo構成で、以下のパッケージで構成されています：

```
kakei/
├── packages/
│   ├── backend/     # TypeScript/Node.js バックエンド
│   └── frontend/    # Vue.js フロントエンド
├── dist/           # ビルド出力
└── README.md
```

## セットアップ

### 必要条件

- Node.js (v16以上)
- npm (v7以上)
- Google Cloud Platformのプロジェクト（Gmail API用）

### インストール

1. リポジトリをクローン
   ```
   git clone <repository-url>
   cd kakei
   ```

2. 依存パッケージをインストール
   ```
   npm install
   ```

## コマンド

### ビルド

```bash
# 全体をビルド
npm run build

# バックエンドのみビルド
npm run build:backend

# フロントエンドのみビルド
npm run build:frontend
```

### 開発サーバー

```bash
# バックエンド開発サーバー起動
npm run dev:server

# フロントエンド開発サーバー起動
npm run dev:frontend
```

### アプリケーション実行

```bash
# レシート処理
npm run dev

# 月次レポート生成
npm run monthly

# 月次レポートをメール送信
npm run monthly-mail
```
   ```

3. 環境変数の設定
   `.env.sample`ファイルを`.env`にコピーして、必要な情報を設定します。
   ```
   cp .env.sample .env
   ```

4. TypeScriptのコンパイル
   ```
   npm run build
   ```

## 環境変数の設定

`.env`ファイルには以下の設定が必要です：

### OpenAI API設定
- `OPENAI_API_KEY`: OpenAI APIのキー（レシート情報の抽出に使用）

### Gmail API設定
- `GMAIL_TOKEN_PATH`: Gmailトークンファイルのパス（デフォルト: `token.json`）
- `GMAIL_CREDENTIALS_PATH`: Gmail認証情報ファイルのパス（デフォルト: `credentials.json`）
- `GMAIL_TO_EMAIL`: 月次レポートの送信先メールアドレス

## 使用方法

### レシート画像の処理

```
npm run dev -- <画像ファイルパスまたはディレクトリパス>
```

例：
```
npm run dev -- ./images/receipt.jpg  # 単一の画像を処理
npm run dev -- ./images              # ディレクトリ内のすべての画像を処理
```

### 月次レポートの表示

```
npm run monthly                # 現在の月のレポートを表示
npm run monthly -- 2025-05     # 2025年5月のレポートを表示
npm run monthly -- 2025 4      # 2025年4月のレポートを表示
```

### 月次レポートのメール送信

```
npm run monthly-mail           # 現在の月のレポートをメールで送信
npm run monthly-mail -- 2025-05 # 2025年5月のレポートをメールで送信
npm run monthly-mail -- 2025 4  # 2025年4月のレポートをメールで送信
```

## データベース操作

SQLiteデータベースを直接操作するためのコマンド：

```sh
docker run -it --rm \
  -v "$(pwd)":/db \
  keinos/sqlite3 \
  sqlite3 /db/database.sqlite
```

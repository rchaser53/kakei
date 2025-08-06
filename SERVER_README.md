# 家計簿アプリケーション - GUI/Webサーバー

家計簿アプリケーションのWebベースGUIサーバーのセットアップと使用方法について説明します。

> **注意**: CLI機能（レシート画像処理、月次レポート生成など）については [README.md](./README.md) を参照してください。

## 概要

このGUI/Webサーバーは、レシート管理システムのWeb インターフェースを提供します。Express.js (Node.js)のバックエンドとVue.jsのフロントエンドで構成されており、以下の機能を提供します：

- 📊 月別のレシートデータの表示と管理
- 🔐 セッションベースの認証システム
- 📤 Google Driveへのデータベースバックアップ
- 📥 Google Driveからの画像・ファイルダウンロード
- ✏️ 手動でのレシート登録・編集・削除
- 📱 レスポンシブデザインによるモバイル対応

## 必要条件

### システム要件
- **Node.js**: v16.0.0 以上
- **npm**: v7.0.0 以上  
- **SQLite3**: データベース（自動でインストールされます）

### Google Cloud Platform 設定
- Google Cloud Platformプロジェクト
- Google Drive API の有効化
- OAuth 2.0 認証情報（`credentials.json`）

> **前提条件**: プロジェクトの基本セットアップ（依存関係のインストールなど）は [README.md](./README.md) の手順に従って完了していることを前提とします。

## GUI/Webサーバーの初期設定

### 1. Google Drive API の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Drive API を有効化
3. OAuth 2.0 クライアント ID を作成（デスクトップアプリケーション）
4. `credentials.json` をダウンロードして `packages/backend/` ディレクトリに配置

### 2. 認証設定

```bash
# 初回のGoogle認証（ブラウザが開きます）
npm run dev:server
```

初回起動時にGoogle認証が必要です。ブラウザが開いて認証を完了すると、`token.json` が自動生成されます。

### 3. 初回ユーザーの作成

サーバーを一度起動してデータベースを初期化した後、管理用ユーザーを作成します：

```bash
# サーバーを停止して、ユーザーを作成
USER_NAME=admin PASSWORD=your_secure_password node insertUser.cjs
```

これで初期セットアップが完了です。

## サーバーの起動

### 開発環境での起動

```bash
# バックエンドの開発サーバー起動
npm run dev:server

# または個別に起動
cd packages/backend
npm run dev:server
```

サーバーは `http://localhost:3000` で起動します。

### 本番環境での起動

```bash
# プロジェクト全体をビルド
npm run build

# 本番サーバー起動
npm run start

# または個別に起動
cd packages/backend
npm run start
```

## 使用方法

### 1. 初回アクセスとログイン

1. ブラウザで `http://localhost:3000` にアクセス
2. 事前に作成したユーザーでログイン

#### ユーザーの作成方法

デフォルトユーザーは設定されていないため、初回利用時には以下のスクリプトを使用してユーザーをデータベースに登録してください：

```bash
# プロジェクトルートディレクトリで実行
# 環境変数でユーザー名とパスワードを指定
USER_NAME=admin PASSWORD=password123 node insertUser.cjs

# または、一行で実行
USER_NAME=your_username PASSWORD=your_password node insertUser.cjs
```

**例**：
```bash
# adminユーザーを作成
USER_NAME=admin PASSWORD=mySecurePassword123 node insertUser.cjs
```

作成後、ブラウザでログイン画面にて設定したユーザー名とパスワードを入力してください。

> ⚠️ **重要**: 
> - データベースファイルが存在しない場合は、先にサーバーを一度起動してデータベースを初期化してください
> - 本番環境では強力なパスワードを設定してください
> - 同じユーザー名で複数回実行するとエラーになります

### 2. 主な機能の使用方法

#### レシートデータの表示
- **月別表示**: 左側のナビゲーションから年月を選択
- **詳細表示**: 各レシートをクリックして詳細情報を確認
- **フィルタリング**: 使用する/しないの切り替え

#### 手動レシート登録
1. 「手動登録」ボタンをクリック
2. 店舗名、金額、日付を入力
3. 「登録」ボタンで保存

#### データベースバックアップ
1. 「データベースアップロード」ボタンをクリック
2. Google Driveの `backup` フォルダに自動保存
3. タイムスタンプ付きファイル名で保存

#### Google Driveからのファイル取得
1. 「ファイル取得」セクションで日付を指定
2. 「検索」ボタンで該当ファイルを表示
3. 「ダウンロード」ボタンで一括取得

## API エンドポイント

### 認証関連
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/status` - 認証状態確認

### レシート管理
- `GET /api/receipts/:year/:month` - 月別レシート取得
- `POST /api/receipts/manual` - 手動レシート登録
- `PUT /api/receipts/:imageHash/use-image` - 使用フラグ更新
- `DELETE /api/receipts/:id` - レシート削除
- `DELETE /api/receipts` - 複数レシート一括削除

### Google Drive 連携
- `POST /api/upload/drive` - データベースバックアップ
- `POST /api/upload/drive/cleanup` - 古いバックアップの削除
- `GET /api/drive/files` - ファイル一覧取得
- `POST /api/drive/download/date` - 日付指定ダウンロード
- `POST /api/drive/download/month` - 月指定ダウンロード
- `GET /api/drive/files/date/:date` - 日付指定ファイル検索
- `GET /api/drive/files/month/:year/:month` - 月指定ファイル検索

## 設定とカスタマイズ

### ポート番号の変更

`packages/backend/src/server.ts` でポート番号を変更できます：

```typescript
const port = process.env.PORT || 3000;
```

環境変数 `PORT` でも設定可能：

```bash
PORT=8080 npm run start
```

### セッション設定

セッションの有効期限やその他の設定は `packages/backend/src/server.ts` で変更できます：

```typescript
res.cookie('session-id', sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000, // 24時間
  sameSite: 'strict',
});
```

### データベースパス

データベースファイルのパスは `packages/backend/src/constants.ts` で設定されています：

```typescript
export const DATABASE_PATH = path.join(process.cwd(), 'database.sqlite3');
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Google Drive APIの認証エラー

```
Error: Google Drive APIの権限が不足しています
```

**解決方法**:
1. `token.json` を削除
2. `credentials.json` が正しい場所にあることを確認
3. サーバーを再起動して再認証

#### 2. ポートがすでに使用されている

```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決方法**:
```bash
# プロセスを確認
lsof -ti:3000

# プロセスを終了
kill -9 $(lsof -ti:3000)
```

#### 3. データベースファイルが見つからない

```
Error: ENOENT: no such file or directory, open 'database.sqlite3'
```

**解決方法**:
1. プロジェクトルートディレクトリから起動していることを確認
2. データベースファイルが存在する場合は、パスを確認

#### 4. フロントエンドのビルドエラー

**解決方法**:
```bash
# node_modules を削除して再インストール
rm -rf node_modules packages/*/node_modules
npm install

# 再ビルド
npm run build
```

## ログとデバッグ

### ログレベルの設定

サーバーは詳細なログを出力します：

```bash
# 開発環境（詳細ログ）
npm run dev:server

# 本番環境（エラーログのみ）
NODE_ENV=production npm run start
```

### デバッグモード

Node.js のデバッグ機能を使用：

```bash
# デバッグモードでサーバー起動
node --inspect dist/server.js

# Chrome DevTools でデバッグ
# chrome://inspect にアクセス
```

## セキュリティ考慮事項

### 本番環境での推奨設定

1. **HTTPS の使用**
   ```typescript
   // server.ts
   app.use((req, res, next) => {
     if (req.header('x-forwarded-proto') !== 'https') {
       res.redirect(`https://${req.header('host')}${req.url}`);
     } else {
       next();
     }
   });
   ```

2. **セキュリティヘッダーの追加**
   ```bash
   npm install helmet
   ```
   ```typescript
   import helmet from 'helmet';
   app.use(helmet());
   ```

3. **環境変数の設定**
   ```bash
   NODE_ENV=production
   SESSION_SECRET=your-secret-key
   ```

## 開発者向け情報

### GUI/Webサーバーのプロジェクト構造

```
packages/backend/
├── src/
│   ├── server.ts          # メインサーバーファイル
│   ├── auth.ts           # 認証ロジック
│   ├── db.ts             # データベース操作
│   ├── upload-service.ts # Google Drive アップロード
│   ├── download-service.ts # Google Drive ダウンロード
│   ├── middleware.ts     # Express ミドルウェア
│   └── constants.ts      # 定数定義
├── dist/                 # ビルド出力
└── package.json

packages/frontend/         # Vue.js フロントエンド
├── src/
├── public/
└── package.json
```

### GUI/Webサーバー開発用コマンド

```bash
# GUI/Webサーバー起動
npm run dev:server

# フロントエンド開発サーバー起動
npm run dev:frontend

# フロントエンドのビルド
npm run build:frontend

# フロントエンドのプレビュー
npm run preview
```

> **注意**: CLI機能の開発については [README.md](./README.md) を参照してください。

### 新機能の追加

1. **新しいAPIエンドポイントの追加**
   - `packages/backend/src/server.ts` にルートを追加
   - 必要に応じて `packages/backend/src/db.ts` にデータベース操作を追加

2. **新しいサービスの追加**
   - `packages/backend/src/` ディレクトリに新しいファイルを作成
   - `server.ts` でインポートして使用

3. **フロントエンド機能の追加**
   - `packages/frontend/src/` でVue.jsコンポーネントを追加・編集
   - APIエンドポイントとの連携を実装

## パフォーマンス最適化

### 本番環境での推奨設定

1. **gzip圧縮の有効化**
   ```bash
   npm install compression
   ```
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

2. **静的ファイルのキャッシュ**
   ```typescript
   app.use(express.static('dist/frontend', {
     maxAge: '1d'
   }));
   ```

## サポートとコントリビューション

### 問題の報告

問題や機能要求がある場合は、以下の情報を含めてIssueを作成してください：

- サーバーのバージョン
- Node.js のバージョン
- エラーメッセージの全文
- 再現手順

### 開発への参加

1. フォークして開発ブランチを作成
2. 変更を加えてテスト
3. プルリクエストを作成

---

## ライセンス

このプロジェクトは ISC ライセンスの下で公開されています。

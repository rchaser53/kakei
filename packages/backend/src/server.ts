import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';
import {
  createDatabaseConnection,
  closeDatabase,
  getMonthlyReceiptDetails,
  updateUseImage,
  insertManualReceipt,
  getAvailableMonths,
  deleteReceipt,
  deleteMultipleReceipts
} from './db.js';
import { DATABASE_PATH } from './constants.js';
import {
  createUserTable,
  createSessionTable,
  authenticateUser,
  createSession,
  deleteSession,
  cleanupExpiredSessions
} from './auth.js';
import { requireAuth, checkAuth } from './middleware.js';

// ES Moduleでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// ミドルウェアの設定
app.use(express.json());
app.use(cookieParser());

// データベースの初期化
async function initializeDatabase() {
  const db = createDatabaseConnection(DATABASE_PATH);
  try {
    await createUserTable(db);
    await createSessionTable(db);
    await cleanupExpiredSessions(db);
    console.log('データベース初期化完了');
  } catch (error) {
    console.error('データベース初期化エラー:', error);
  } finally {
    await closeDatabase(db);
  }
}

// 認証関連のAPI

// ログインAPI
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });
  }
  
  const db = createDatabaseConnection(DATABASE_PATH);
  
  try {
    const userId = await authenticateUser(db, username, password);
    
    if (!userId) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' });
    }
    
    const sessionId = await createSession(db, userId);
    
    // セッションIDをCookieに設定（24時間有効）
    res.cookie('session-id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      sameSite: 'strict'
    });
    
    res.json({ success: true, message: 'ログインしました' });
  } catch (error) {
    console.error('ログインエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await closeDatabase(db);
  }
});

// ログアウトAPI
app.post('/api/auth/logout', async (req, res) => {
  const sessionId = req.cookies['session-id'];
  
  if (sessionId) {
    const db = createDatabaseConnection(DATABASE_PATH);
    
    try {
      await deleteSession(db, sessionId);
    } catch (error) {
      console.error('セッション削除エラー:', error);
    } finally {
      await closeDatabase(db);
    }
  }
  
  res.clearCookie('session-id');
  res.json({ success: true, message: 'ログアウトしました' });
});

// 認証状態確認API
app.get('/api/auth/status', checkAuth, (req, res) => {
  res.json({ 
    authenticated: !!req.userId,
    userId: req.userId
  });
});

// 静的ファイル配信（認証が必要）
app.use('/static', express.static(path.join(__dirname, '../../../dist/frontend')));

// use_imageカラムを更新するAPI
app.put('/api/receipts/:imageHash/use-image', async (req, res) => {
  const imageHash = req.params.imageHash;
  const { use_image } = req.body;
  if (typeof use_image !== 'boolean') {
    return res.status(400).json({ error: 'use_imageはbooleanで指定してください' });
  }
  const db = createDatabaseConnection(DATABASE_PATH);
  try {
    await updateUseImage(imageHash, use_image, db);
    res.json({ success: true });
  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  } finally {
    await closeDatabase(db).catch(err =>
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
  }
});


// 静的ファイルを提供
app.use(express.static(path.join(__dirname, '../../../dist/frontend')));

// 月ごとのレシート情報を取得するAPIエンドポイント
app.get('/api/receipts/:year/:month', async (req, res) => {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: '無効な年または月です。月は1から12の間で指定してください。' });
  }

  const db = createDatabaseConnection(DATABASE_PATH);

  try {
    const details = await getMonthlyReceiptDetails(year, month, db);
    res.json(details);
  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  } finally {
    await closeDatabase(db).catch(err =>
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
  }
});

// 利用可能な年月のリストを取得するAPIエンドポイント
app.get('/api/available-months', async (req, res) => {
  const db = createDatabaseConnection(DATABASE_PATH);

  try {
    const availableMonths = await getAvailableMonths(db);
    res.json(availableMonths);
  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  } finally {
    await closeDatabase(db).catch(err =>
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
  }
});

// ルートパスへのアクセス（すべてのケースでindex.htmlを返す）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dist/frontend/index.html'));
});

// メインアプリ専用ルート（認証必須）
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dist/frontend/index.html'));
});

// 既存のAPIエンドポイントに認証を適用

// 手動レシート登録API
app.post('/api/receipts/manual', async (req, res) => {
  const { store_name, total_amount, receipt_date } = req.body;
  if (!store_name || !total_amount || !receipt_date) {
    return res.status(400).json({ error: 'store_name, total_amount, receipt_dateは必須です' });
  }
  const db = createDatabaseConnection(DATABASE_PATH);
  try {
    // 手動登録の場合はuse_imageを常に1（true）にする
    await insertManualReceipt(store_name, total_amount, receipt_date, true, db);
    res.json({ success: true });
  } catch (error) {
    console.error('登録エラー:', error);
    res.status(500).json({ error: '登録に失敗しました' });
  } finally {
    await closeDatabase(db).catch(() => {});
  }
});

// 単一レシート削除API
app.delete('/api/receipts/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: '無効なIDです' });
  }
  
  const db = createDatabaseConnection(DATABASE_PATH);
  try {
    const deleted = await deleteReceipt(id, db);
    if (deleted) {
      res.json({ success: true, message: 'レシートを削除しました' });
    } else {
      res.status(404).json({ error: 'レシートが見つかりません' });
    }
  } catch (error) {
    console.error('削除エラー:', error);
    res.status(500).json({ error: '削除に失敗しました' });
  } finally {
    await closeDatabase(db).catch(() => {});
  }
});

// 複数レシート一括削除API
app.delete('/api/receipts', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDの配列が必要です' });
  }
  
  // 全てのIDが数値かチェック
  const validIds = ids.filter(id => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) {
    return res.status(400).json({ error: '有効なIDが含まれていません' });
  }
  
  const db = createDatabaseConnection(DATABASE_PATH);
  try {
    const deletedCount = await deleteMultipleReceipts(validIds, db);
    res.json({ 
      success: true, 
      message: `${deletedCount}件のレシートを削除しました`,
      deletedCount 
    });
  } catch (error) {
    console.error('一括削除エラー:', error);
    res.status(500).json({ error: '一括削除に失敗しました' });
  } finally {
    await closeDatabase(db).catch(() => {});
  }
});

// サーバーを起動
async function startServer() {
  console.log('Starting server initialization...');
  await initializeDatabase();
  console.log('Database initialized, starting Express server...');
  
  app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
  });
}

console.log('About to start server...');
startServer().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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

// ES Moduleでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;


// JSONボディパーサーを有効化（必ずルーティングより前に記述）
app.use(express.json());

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
app.use(express.static(path.join(__dirname, '../dist/frontend')));

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

// ルートパスへのアクセス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/frontend/index.html'));
});


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
app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
});

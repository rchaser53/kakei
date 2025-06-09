import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  createDatabaseConnection,
  closeDatabase,
  getMonthlyReceiptDetails,
  updateUseImage
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
app.use(express.static(path.join(__dirname, '../public')));

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
    // データベースから利用可能な年月のリストを取得
    const query = `
      SELECT 
        strftime('%Y', receipt_date) as year,
        strftime('%m', receipt_date) as month
      FROM receipts
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    db.all(query, (err, rows: any[]) => {
      if (err) {
        console.error('エラー:', err);
        return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
      }

      const availableMonths = rows.map(row => ({
        year: parseInt(row.year, 10),
        month: parseInt(row.month, 10)
      }));

      res.json(availableMonths);
    });
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
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// サーバーを起動
app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
});

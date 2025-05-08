import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES Moduleでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// データベースの設定
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// データベースからレシートデータを取得する関数
function getAllReceipts(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM receipts ORDER BY id ASC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// 合計金額を計算する関数
function calculateTotal(receipts: any[]): number {
  return receipts.reduce((total, receipt) => total + receipt.price, 0);
}

// メイン関数
async function main(): Promise<void> {
  try {
    // レシートデータを取得
    const receipts = await getAllReceipts();
    
    console.log('=== レシートデータ ===');
    console.log('ID | 品名 | 金額 | 作成日時');
    console.log('------------------------');
    
    receipts.forEach(receipt => {
      console.log(`${receipt.id} | ${receipt.item} | ${receipt.price} | ${receipt.created_at}`);
    });
    
    // 合計金額を計算
    const total = calculateTotal(receipts);
    console.log('------------------------');
    console.log(`合計金額: ${total}円`);
    
    // データベース接続を閉じる
    db.close((err) => {
      if (err) {
        console.error('データベース接続を閉じる際にエラーが発生しました:', err);
      } else {
        console.log('データベース接続を閉じました');
      }
    });
    
  } catch (error) {
    console.error('エラー:', error);
    // エラーが発生した場合もデータベース接続を閉じる
    db.close();
  }
}

// メイン関数を実行
main();

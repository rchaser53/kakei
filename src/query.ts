import {
  getAllReceipts,
  closeDatabase,
  createDatabaseConnection,
  getReceiptDetails,
  getReceiptTotal,
} from './db.js';
import { DATABASE_PATH } from './constants.js';

// メイン関数
async function main(): Promise<void> {
  // データベース接続を作成
  const db = createDatabaseConnection(DATABASE_PATH);

  try {
    // レシートデータを取得
    const receipts = await getAllReceipts(db);

    // レシートをハッシュでグループ化
    const receiptsByHash: { [key: string]: any[] } = {};
    receipts.forEach(row => {
      if (!receiptsByHash[row.image_hash]) {
        receiptsByHash[row.image_hash] = [];
      }
      receiptsByHash[row.image_hash].push(row);
    });

    // 各レシートの情報を表示
    console.log('=== レシートデータ ===');

    for (const imageHash in receiptsByHash) {
      const rows = receiptsByHash[imageHash];
      const firstRow = rows[0];
      const shortHash = imageHash.substring(0, 8) + '...';
      const total = await getReceiptTotal(imageHash, db);

      console.log(`\nレシートID: ${firstRow.id}`);
      console.log(`画像ハッシュ: ${shortHash}`);
      console.log(`作成日時: ${firstRow.created_at}`);
      console.log('------------------------');
      console.log('品名 | 金額');
      console.log('------------------------');

      rows.forEach(row => {
        console.log(`${row.item} | ${row.price}円`);
      });

      console.log('------------------------');
      console.log(`合計金額: ${total}円`);
      console.log('========================');
    }

    // データベース接続を閉じる
    await closeDatabase(db);
    console.log('データベース接続を閉じました');
  } catch (error) {
    console.error('エラー:', error);
    // エラーが発生した場合もデータベース接続を閉じる
    await closeDatabase(db).catch((err: Error) =>
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
  }
}

// メイン関数を実行
main();

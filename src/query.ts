import { getAllReceipts, closeDatabase, createDatabaseConnection } from './db.js';

// 合計金額を計算する関数
function calculateTotal(receipts: any[]): number {
  return receipts.reduce((total, receipt) => total + receipt.price, 0);
}

// メイン関数
async function main(): Promise<void> {
  // データベース接続を作成
  const db = createDatabaseConnection();
  
  try {
    // レシートデータを取得
    const receipts = await getAllReceipts(db);
    
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

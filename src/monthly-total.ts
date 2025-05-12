import { createDatabaseConnection, closeDatabase, getMonthlyTotal, getMonthlyReceiptDetails } from './db.js';
import { DATABASE_PATH } from './constants.js';

// コマンドライン引数から年と月を取得
function getYearMonthFromArgs(): { year: number, month: number } {
  const args = process.argv.slice(2);
  
  // 引数がない場合は現在の年月を使用
  if (args.length === 0) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1 // JavaScriptの月は0から始まるため+1
    };
  }
  
  // 引数が1つの場合は「YYYY-MM」または「YYYY/MM」形式と仮定
  if (args.length === 1) {
    const dateStr = args[0];
    const parts = dateStr.split(/[-\/]/); // ハイフンまたはスラッシュで分割
    
    if (parts.length !== 2) {
      console.error('エラー: 日付形式が無効です。「YYYY-MM」または「YYYY/MM」形式で指定してください。');
      process.exit(1);
    }
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      console.error('エラー: 無効な年または月です。月は1から12の間で指定してください。');
      process.exit(1);
    }
    
    return { year, month };
  }
  
  // 引数が2つの場合は最初が年、次が月と仮定
  if (args.length >= 2) {
    const year = parseInt(args[0], 10);
    const month = parseInt(args[1], 10);
    
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      console.error('エラー: 無効な年または月です。月は1から12の間で指定してください。');
      process.exit(1);
    }
    
    return { year, month };
  }
  
  // デフォルト値（ここには到達しないはずだが、TypeScriptのために必要）
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

// 月の名前を取得する関数
function getMonthName(month: number): string {
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  return monthNames[month - 1];
}

// メイン関数
async function main(): Promise<void> {
  // データベース接続を作成
  const db = createDatabaseConnection(DATABASE_PATH);
  
  try {
    // コマンドライン引数から年と月を取得
    const { year, month } = getYearMonthFromArgs();
    
    console.log(`=== ${year}年${getMonthName(month)}の家計簿 ===`);
    
    // 詳細情報を取得
    const details = await getMonthlyReceiptDetails(year, month, db);
    
    if (details.receipts.length === 0) {
      console.log(`${year}年${getMonthName(month)}のレシートデータはありません。`);
    } else {
      // レシートをハッシュでグループ化
      const receiptsByHash: { [key: string]: any[] } = {};
      details.receipts.forEach(row => {
        if (!receiptsByHash[row.image_hash]) {
          receiptsByHash[row.image_hash] = [];
        }
        receiptsByHash[row.image_hash].push(row);
      });
      
      // 各レシートの情報を表示
      console.log(`合計 ${Object.keys(receiptsByHash).length} 件のレシート`);
      
      for (const imageHash in receiptsByHash) {
        const rows = receiptsByHash[imageHash];
        const firstRow = rows[0];
        const date = new Date(firstRow.created_at);
        const formattedDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
        
        console.log(`\n[${formattedDate}] レシートID: ${firstRow.id}`);
        console.log('------------------------');
        console.log('店舗名 | 合計金額');
        console.log('------------------------');
        
        let receiptTotal = 0;
        rows.forEach(row => {
          console.log(`${row.store_name} | ${row.total_amount}円`);
          receiptTotal += row.total_amount;
        });
        
        console.log('------------------------');
        console.log(`小計: ${receiptTotal}円`);
      }
      
      console.log('\n========================');
      console.log(`${year}年${getMonthName(month)}の合計金額: ${details.total}円`);
    }
    
    // データベース接続を閉じる
    await closeDatabase(db);
    
  } catch (error) {
    console.error('エラー:', error);
    // エラーが発生した場合もデータベース接続を閉じる
    await closeDatabase(db).catch(err => 
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
  }
}

// メイン関数を実行
main();

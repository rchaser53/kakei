import fs from 'fs/promises';
import path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import { createDatabaseConnection, closeDatabase, getMonthlyTotal, getMonthlyReceiptDetails } from './db.js';
import { DATABASE_PATH } from './constants.js';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// Gmail APIのスコープ
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// トークンとクレデンシャルのパス
const TOKEN_PATH = path.join(process.cwd(), process.env.GMAIL_TOKEN_PATH || 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), process.env.GMAIL_CREDENTIALS_PATH || 'credentials.json');

// 送信先メールアドレス
const TO_EMAIL = process.env.GMAIL_TO_EMAIL || 'dusk41@gmail.com';

/**
 * 保存された認証情報を読み込む関数
 * @returns {Promise<any|null>}
 */
async function loadSavedCredentialsIfExist(): Promise<any> {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content.toString());
    return google.auth.fromJSON(credentials) as any;
  } catch (err) {
    return null;
  }
}

/**
 * 認証情報をファイルに保存する関数
 * @param {any} client 
 * @returns {Promise<void>}
 */
async function saveCredentials(client: any) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content.toString());
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * 認証を行う関数
 * @returns {Promise<any>}
 */
async function authorize(): Promise<any> {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  }) as any;
  if (client && client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * コマンドライン引数から年と月を取得
 * @returns {{ year: number, month: number }}
 */
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

/**
 * 月の名前を取得する関数
 * @param {number} month 
 * @returns {string}
 */
function getMonthName(month: number): string {
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  return monthNames[month - 1];
}

/**
 * 月次レポートを生成する関数
 * @param {number} year 
 * @param {number} month 
 * @returns {Promise<string>}
 */
async function generateMonthlyReport(year: number, month: number): Promise<string> {
  // データベース接続を作成
  const db = createDatabaseConnection(DATABASE_PATH);
  
  try {
    // 詳細情報を取得
    const details = await getMonthlyReceiptDetails(year, month, db);
    
    // レポート文字列を作成
    let report = `=== ${year}年${getMonthName(month)}の家計簿 ===\n\n`;
    
    if (details.receipts.length === 0) {
      report += `${year}年${getMonthName(month)}のレシートデータはありません。\n`;
    } else {
      // レシートをハッシュでグループ化
      const receiptsByHash: { [key: string]: any[] } = {};
      details.receipts.forEach(row => {
        if (!receiptsByHash[row.image_hash]) {
          receiptsByHash[row.image_hash] = [];
        }
        receiptsByHash[row.image_hash].push(row);
      });
      
      // 各レシートの情報を追加
      report += `合計 ${Object.keys(receiptsByHash).length} 件のレシート\n\n`;
      
      for (const imageHash in receiptsByHash) {
        const rows = receiptsByHash[imageHash];
        const firstRow = rows[0];
        const date = new Date(firstRow.created_at);
        const formattedDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
        
        report += `[${formattedDate}] レシートID: ${firstRow.id}\n`;
        report += '------------------------\n';
        report += '店舗名 | 合計金額\n';
        report += '------------------------\n';
        
        let receiptTotal = 0;
        rows.forEach(row => {
          report += `${row.store_name} | ${row.total_amount}円\n`;
          receiptTotal += row.total_amount;
        });
        
        report += '------------------------\n';
        report += `小計: ${receiptTotal}円\n\n`;
      }
      
      report += '========================\n';
      report += `${year}年${getMonthName(month)}の合計金額: ${details.total}円\n`;
    }
    
    // データベース接続を閉じる
    await closeDatabase(db);
    
    return report;
  } catch (error) {
    // エラーが発生した場合もデータベース接続を閉じる
    await closeDatabase(db).catch(err => 
      console.error('データベース接続を閉じる際にエラーが発生しました:', err)
    );
    throw error;
  }
}

/**
 * メールを送信する関数
 * @param {any} auth 認証済みのOAuth2クライアント
 * @param {string} subject メールの件名
 * @param {string} messageText メール本文
 * @returns {Promise<any>}
 */
async function sendEmail(auth: any, subject: string, messageText: string) {
  const gmail = google.gmail({version: 'v1', auth});
  
  // メールの作成
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    'From: me',
    `To: ${TO_EMAIL}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    messageText,
  ];
  const message = messageParts.join('\n');

  // Base64エンコード
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // メール送信
  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    console.log('メールが正常に送信されました。');
    console.log(`メッセージID: ${res.data.id}`);
    return res.data;
  } catch (error) {
    console.error('メール送信中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // コマンドライン引数から年と月を取得
    const { year, month } = getYearMonthFromArgs();
    
    // 月次レポートを生成
    const report = await generateMonthlyReport(year, month);
    
    // レポートをコンソールに表示
    console.log(report);
    
    // 認証を行う
    const auth = await authorize();
    
    // メールの件名
    const subject = `${year}年${getMonthName(month)}の家計簿レポート`;
    
    // メールを送信
    await sendEmail(auth, subject, report);
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

// メイン関数を実行
main();

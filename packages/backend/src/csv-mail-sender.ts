import fs from 'fs/promises';
import path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// Gmail APIのスコープ
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// トークンとクレデンシャルのパス
const TOKEN_PATH = path.join(process.cwd(), process.env.GMAIL_TOKEN_PATH || 'token.json');
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  process.env.GMAIL_CREDENTIALS_PATH || 'credentials.json'
);

// 送信先メールアドレス
const TO_EMAIL = process.env.GMAIL_TO_EMAIL || 'dusk41@gmail.com';

// レシートデータの型定義
interface ReceiptData {
  date: string; // mm/dd形式
  storeName: string;
  amount: number;
}

/**
 * 保存された認証情報を読み込む関数
 * @returns {Promise<any|null>}
 */
const loadSavedCredentialsIfExist = async (): Promise<any> => {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content.toString());
    return google.auth.fromJSON(credentials) as any;
  } catch (err) {
    return null;
  }
};

/**
 * 認証情報をファイルに保存する関数
 * @param {any} client
 * @returns {Promise<void>}
 */
const saveCredentials = async (client: any) => {
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
};

/**
 * 認証を行う関数
 * @returns {Promise<any>}
 */
const authorize = async (): Promise<any> => {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = (await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })) as any;
  if (client && client.credentials) {
    await saveCredentials(client);
  }
  return client;
};

/**
 * CSVファイルを読み取り、ReceiptData配列として返す関数
 * CSVフォーマット: 日付(mm/dd), 店名, 金額
 * @param {string} csvFilePath CSVファイルのパス
 * @returns {Promise<ReceiptData[]>}
 */
const readReceiptCsvFile = async (csvFilePath: string): Promise<ReceiptData[]> => {
  try {
    const fileContent = await fs.readFile(csvFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    const results: ReceiptData[] = [];
    
    // ヘッダー行をスキップするかどうかを判定
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('日付') || firstLine.includes('date') || 
          firstLine.includes('店') || firstLine.includes('store') ||
          firstLine.includes('金額') || firstLine.includes('amount')) {
        startIndex = 1; // ヘッダー行をスキップ
      }
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // カンマで分割（クォートを考慮した簡易的な処理）
      const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
      
      if (parts.length < 3) {
        console.warn(`スキップ: 列数が不足している行 ${i + 1}: ${line}`);
        continue;
      }
      
      const date = parts[0];
      const storeName = parts[1];
      const amountStr = parts[2];
      
      // 金額を数値に変換
      const amount = parseFloat(amountStr.replace(/[¥,円]/g, ''));
      
      if (isNaN(amount)) {
        console.warn(`スキップ: 金額が無効な行 ${i + 1}: ${line}`);
        continue;
      }
      
      // 日付の形式をチェック（mm/dd形式）
      const datePattern = /^\d{1,2}\/\d{1,2}$/;
      if (!datePattern.test(date)) {
        console.warn(`スキップ: 日付形式が無効な行 ${i + 1}: ${line}`);
        continue;
      }
      
      const receiptData: ReceiptData = {
        date,
        storeName,
        amount,
      };
      
      results.push(receiptData);
    }
    
    console.log(`${results.length}件のレシートデータを読み込みました`);
    return results;
    
  } catch (error) {
    console.error('CSVファイルの読み込みに失敗しました:', error);
    throw error;
  }
};

/**
 * 10円単位で切り下げる関数
 * @param {number} amount
 * @returns {number}
 */
const roundDownToTen = (amount: number): number => {
  return Math.floor(amount / 10) * 10;
};

/**
 * 年月を取得する関数
 * @returns {{ year: number, month: number }}
 */
const getCurrentYearMonth = (): { year: number; month: number } => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

/**
 * 月の名前を取得する関数
 * @param {number} month
 * @returns {string}
 */
const getMonthName = (month: number): string => {
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ];
  return monthNames[month - 1];
};

/**
 * CSVデータから月次レポートを生成する関数
 * @param {ReceiptData[]} receipts レシートデータの配列
 * @param {number} year 年
 * @param {number} month 月
 * @returns {string}
 */
const generateMonthlyReportFromCsv = (receipts: ReceiptData[], year: number, month: number): string => {
  let report = `=== ${year}年${getMonthName(month)}の家計簿 ===\n\n`;

  if (receipts.length === 0) {
    report += `${year}年${getMonthName(month)}のレシートデータはありません。\n`;
    return report;
  }

  // 合計金額を計算
  const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const billingAmount = roundDownToTen(Math.floor(totalAmount / 2));

  report += `========================\n`;
  report += `【請求金額】 ${billingAmount}円 (合計金額の1/2を10円単位で切り下げ)\n`;
  report += `【合計金額】 ${totalAmount}円\n`;
  report += `========================\n\n`;

  // レシート情報をテーブル形式で表示
  report += `合計 ${receipts.length} 件のレシート`;

  // 日付でソート（mm/dd形式を考慮）
  const sortedReceipts = receipts.sort((a, b) => {
    const [aMonth, aDay] = a.date.split('/').map(Number);
    const [bMonth, bDay] = b.date.split('/').map(Number);
    
    if (aMonth !== bMonth) {
      return aMonth - bMonth;
    }
    return aDay - bDay;
  });

  // HTMLテーブルを生成
  const htmlTable = `
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr>
          <th>日付</th>
          <th>店舗名</th>
          <th>合計金額</th>
        </tr>
      </thead>
      <tbody>
        ${sortedReceipts
          .map(
            receipt => `
          <tr>
            <td>${receipt.date}</td>
            <td>${receipt.storeName}</td>
            <td>${receipt.amount}円</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  report += htmlTable;
  report += '========================\n';

  return report;
};

/**
 * メールを送信する関数
 * @param {any} auth 認証済みのOAuth2クライアント
 * @param {string} subject メールの件名
 * @param {string} messageHtml メール本文 (HTML)
 * @returns {Promise<any>}
 */
const sendEmail = async (auth: any, subject: string, messageHtml: string) => {
  const gmail = google.gmail({ version: 'v1', auth });

  // メールの作成
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    'From: me',
    `To: ${TO_EMAIL}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    messageHtml,
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
};



/**
 * コマンドライン引数からCSVファイルパスを取得
 * @returns {string}
 */
const getReceiptCsvFilePathFromArgs = (): string => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('エラー: レシートCSVファイルのパスを指定してください。');
    console.log('使用方法: npm run csv-receipt-mail <csvファイルパス>');
    console.log('例: npm run csv-receipt-mail receipts.csv');
    console.log('CSVフォーマット: 日付(mm/dd), 店名, 金額');
    process.exit(1);
  }

  const csvPath = args[0];
  
  // 相対パスの場合は絶対パスに変換
  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.resolve(csvPath);
  
  return absolutePath;
};

/**
 * レシートCSVファイルの例を生成する関数
 * @param {string} outputPath 出力先のパス
 * @returns {Promise<void>}
 */
const generateSampleReceiptCsv = async (outputPath: string): Promise<void> => {
  const sampleData = `日付,店名,金額
9/01,スーパーA,2480
9/03,コンビニB,1200
9/05,ドラッグストアC,850
9/07,レストランD,3500
9/10,スーパーA,1980`;

  await fs.writeFile(outputPath, sampleData, 'utf-8');
  console.log(`サンプルCSVファイルを生成しました: ${outputPath}`);
  console.log('CSVフォーマット: 日付(mm/dd), 店名, 金額');
};

/**
 * メイン関数
 */
const main = async () => {
  try {
    // --sampleオプションをチェック
    if (process.argv.includes('--sample')) {
      const samplePath = 'sample-receipts.csv';
      await generateSampleReceiptCsv(samplePath);
      return;
    }

    // CSVファイルパスを取得
    const csvFilePath = getReceiptCsvFilePathFromArgs();

    // ファイルの存在確認
    try {
      await fs.access(csvFilePath);
    } catch (error) {
      console.error(`エラー: CSVファイルが見つかりません: ${csvFilePath}`);
      process.exit(1);
    }

    console.log(`レシートCSVファイルを読み込み中: ${csvFilePath}`);

    // CSVファイルを読み込み
    const receiptData = await readReceiptCsvFile(csvFilePath);

    if (receiptData.length === 0) {
      console.log('処理するレシートデータがありません。');
      return;
    }

    // 現在の年月を取得（必要に応じてコマンドライン引数から取得するように拡張可能）
    const { year, month } = getCurrentYearMonth();

    // 月次レポートを生成
    const reportText = generateMonthlyReportFromCsv(receiptData, year, month);

    // HTMLレポートを生成
    const reportHtml = `
      <html>
        <body>
          <h1>${year}年${getMonthName(month)}の家計簿レポート</h1>
          <pre>${reportText}</pre>
        </body>
      </html>
    `;

    // レポートをコンソールに表示
    console.log('\n=== 生成されたレポート ===');
    console.log(reportText);

    // 認証を行う
    console.log('Gmail APIの認証中...');
    const auth = await authorize();

    // メールの件名
    const subject = `${year}年${getMonthName(month)}の家計簿レポート (CSV版)`;

    // 送信確認
    console.log(`\nメールを送信します: ${TO_EMAIL}`);
    console.log(`件名: ${subject}`);
    console.log('続行しますか？ (y/N)');
    
    // Node.jsでの標準入力読み取り（簡易版）
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const confirmation = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (confirmation !== 'y' && confirmation !== 'yes') {
      console.log('メール送信をキャンセルしました。');
      process.exit(0);
    }

    // メール送信
    await sendEmail(auth, subject, reportHtml);

  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  } finally {
    process.stdin.pause();
  }
};

// メイン関数を実行
main();
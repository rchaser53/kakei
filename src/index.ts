import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { parseAndSaveCSV, closeDatabase, createDatabaseConnection, initializeDatabase } from "./db.js";
import path from "path";
import { DATABASE_PATH, SUPPORTED_IMAGE_EXTENSIONS } from "./constants.js";
import sqlite3 from "sqlite3";
import crypto from "crypto";

// 環境変数を読み込む
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

const openai = new OpenAI({
  apiKey,
});

// コマンドライン引数からパスを取得
function getPathFromArgs(): string {
  const args = process.argv.slice(2);
  
  // 引数がない場合はヘルプを表示して終了
  if (args.length === 0) {
    console.log("使用方法: node dist/index.js <画像ファイルパスまたはディレクトリパス>");
    console.log("例: node dist/index.js ./images/receipt.jpg");
    console.log("例: node dist/index.js ./images");
    process.exit(1);
  }
  
  const inputPath = args[0];
  
  // パスが存在するか確認
  if (!fs.existsSync(inputPath)) {
    console.error(`エラー: パス '${inputPath}' が見つかりません。`);
    process.exit(1);
  }
  
  return inputPath;
}

// ディレクトリ内のすべての対応画像ファイルを再帰的に取得
function getAllImageFiles(dirPath: string): string[] {
  let imageFiles: string[] = [];
  
  // ディレクトリ内のファイルとディレクトリを取得
  const items = fs.readdirSync(dirPath);
  
  // サポートされている拡張子の正規表現パターンを作成
  const extensionPattern = new RegExp(`\\.(${SUPPORTED_IMAGE_EXTENSIONS.join('|')})$`, 'i');
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // ディレクトリの場合は再帰的に処理
      imageFiles = imageFiles.concat(getAllImageFiles(itemPath));
    } else if (stats.isFile() && extensionPattern.test(item)) {
      // サポートされている画像ファイルの場合はリストに追加
      imageFiles.push(itemPath);
    }
  }
  
  return imageFiles;
}

// 画像からハッシュを生成する関数
function generateImageHash(imagePath: string): string {
  // 画像ファイルを読み込む
  const imageBuffer = fs.readFileSync(imagePath);
  
  // SHA-256ハッシュを生成
  const hash = crypto.createHash('sha256');
  hash.update(imageBuffer);
  return hash.digest('hex');
}

// データベースに画像ハッシュが存在するか確認する関数
async function isImageHashExists(imageHash: string, db: sqlite3.Database): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 FROM receipts WHERE image_hash = ?', [imageHash], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(!!row); // rowが存在すればtrue、存在しなければfalse
    });
  });
}

// 画像を処理してデータベースに保存
async function processImage(imagePath: string, db: sqlite3.Database): Promise<void> {
  console.log(`処理する画像: ${imagePath}`);
  
  try {
    // 画像からハッシュを生成
    const imageHash = generateImageHash(imagePath);
    console.log(`画像ハッシュ: ${imageHash}`);
    
    // データベースに同じハッシュが存在するか確認
    const exists = await isImageHashExists(imageHash, db);
    if (exists) {
      console.log(`画像ハッシュ ${imageHash} のレコードは既に存在します。スキップします。`);
      return;
    }
    
    // 画像ファイルを読み込む
    const base64Image = fs.readFileSync(imagePath, { encoding: "base64" });
    
    // 型アサーションを使用してAPIの型エラーを回避
    const requestBody = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { 
              type: "input_text", 
              text: `アップロードされた画像がレシートかどうかを判断し、以下の形式で回答してください。

もし画像がレシートの場合:
1. 最初の行に "IS_RECEIPT: true" と記載してください。
2. 次の行から、小計を出すために必要な品名と金額をCSVフォーマットで抽出してください。
3. CSVのヘッダーは品名を「item」、金額を「price」としてください。

もし画像がレシートでない場合:
1. "IS_RECEIPT: false" と記載してください。
2. その後に、画像の内容について簡単な説明を追加してください。

回答は上記の形式に厳密に従ってください。
` 
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`
            } as any,
          ],
        },
      ],
    };

    // @ts-ignore - OpenAIのAPIの型定義に問題がある場合の回避策
    const response = await openai.responses.create(requestBody);
    
    // レスポンスを取得
    const responseText = response.output_text;
    
    // レシートかどうかを判断
    if (responseText.startsWith("IS_RECEIPT: false")) {
      console.error(`エラー: ${imagePath} はレシートではありません。処理をスキップします。`);
      console.error(`詳細: ${responseText.split('\n').slice(1).join('\n')}`);
      return;
    }
    
    // レシートの場合、CSVデータを抽出
    let csvData = responseText.replace(/^IS_RECEIPT: true\n/, '');
    
    // マークダウンの```csv```と```を削除（もし存在する場合）
    csvData = csvData.replace(/```csv\n/, '').replace(/```$/, '');
    
    console.log("整形後のCSVデータ:");
    console.log(csvData);
    
    // CSVデータをSQLiteに保存
    const inserted = await parseAndSaveCSV(csvData, imageHash, db);
    if (inserted) {
      console.log(`${imagePath} のデータベースへの保存が完了しました`);
    } else {
      console.log(`${imagePath} は既に処理済みです。スキップしました。`);
    }
    
  } catch (error) {
    console.error(`${imagePath} の処理中にエラーが発生しました:`, error);
  }
}

// メイン関数
async function main(): Promise<void> {
  // データベース接続を作成
  const db = createDatabaseConnection(DATABASE_PATH);
  
  // データベースを初期化
  initializeDatabase(db);
  
  try {
    // パスを取得
    const inputPath = getPathFromArgs();
    
    // パスの種類を確認
    const stats = fs.statSync(inputPath);
    
    if (stats.isDirectory()) {
      // ディレクトリの場合は、すべての対応画像ファイルを取得して処理
      console.log(`ディレクトリ ${inputPath} 内のすべての対応画像ファイルを処理します...`);
      const imageFiles = getAllImageFiles(inputPath);
      
      if (imageFiles.length === 0) {
        console.log(`ディレクトリ ${inputPath} 内に対応画像ファイルが見つかりませんでした。`);
        return;
      }
      
      console.log(`${imageFiles.length} 個の対応画像ファイルが見つかりました。`);
      
      // 各画像ファイルを処理
      for (const imageFile of imageFiles) {
        await processImage(imageFile, db);
      }
      
      console.log(`すべての対応画像ファイルの処理が完了しました。`);
    } else {
      // ファイルの場合は、そのファイルを処理
      await processImage(inputPath, db);
    }
    
    // データベース接続を閉じる
    await closeDatabase(db);
    console.log("データベース接続を閉じました");
    
  } catch (error) {
    console.error("Error:", error);
    // エラーが発生した場合もデータベース接続を閉じる
    try {
      await closeDatabase(db);
    } catch (err) {
      console.error("データベース接続を閉じる際にエラーが発生しました:", err);
    }
  }
}

// メイン関数を実行し、Promiseが解決されるまで待機
(async () => {
  await main();
})();

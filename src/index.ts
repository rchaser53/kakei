import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { parseAndSaveCSV, closeDatabase, createDatabaseConnection, initializeDatabase } from "./db.js";

// 環境変数を読み込む
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

const openai = new OpenAI({
  apiKey,
});

const imagePath = "./PXL_20250506_053306419.jpg"; 
const base64Image = fs.readFileSync(imagePath, { encoding: "base64" });

async function main(): Promise<void> {
  // データベース接続を作成
  const db = createDatabaseConnection();
  
  // データベースを初期化
  initializeDatabase(db);
  
  try {
    // 型アサーションを使用してAPIの型エラーを回避
    const requestBody = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { 
              type: "input_text", 
              text: `アップロードした画像はレシートの画像です。
小計を出すために必要な品名と金額を抜き出し、CSVのフォーマットで返却してください。
ヘッダーは品名は「item」、金額は「price」としてください。
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

    console.log(response);
    
    // CSVデータを取得し、マークダウン記法を削除
    let csvData = response.output_text;
    
    // マークダウンの```csv```と```を削除
    csvData = csvData.replace(/```csv\n/, '').replace(/```$/, '');
    
    console.log("整形後のCSVデータ:");
    console.log(csvData);
    
    // CSVデータをSQLiteに保存
    await parseAndSaveCSV(csvData, db);
    console.log("データベースへの保存が完了しました");
    
    // データベース接続を閉じる
    await closeDatabase(db);
    console.log("データベース接続を閉じました");
    
  } catch (error) {
    console.error("Error:", error);
    // エラーが発生した場合もデータベース接続を閉じる
    await closeDatabase(db).catch((err: Error) => console.error("データベース接続を閉じる際にエラーが発生しました:", err));
  }
}

// メイン関数を実行し、Promiseが解決されるまで待機
(async () => {
  await main();
})();

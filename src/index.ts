import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

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
    console.log(response.output_text);
  } catch (error) {
    console.error("Error:", error);
  }
}

// メイン関数を実行し、Promiseが解決されるまで待機
(async () => {
  await main();
})();

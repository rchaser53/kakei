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

async function main(): Promise<void> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {"role": "user", "content": "write a haiku about ai"},
      ],
    });

    console.log(completion.choices[0].message);
  } catch (error) {
    console.error("Error:", error);
  }
}

// メイン関数を実行し、Promiseが解決されるまで待機
(async () => {
  await main();
})();

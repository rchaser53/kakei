import fs from "fs";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey,
});

const imagePath = "./PXL_20250506_045157310.jpg"; 
const base64Image = fs.readFileSync(imagePath, "base64");

const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
        {
            role: "user",
            content: [
                { type: "input_text", text: `アップロードした画像はレシートの画像です。
小計を出すために必要な品名と金額を抜き出し、CSVのフォーマットで返却してください。
ヘッダーは品名は「item」、金額は「price」としてください。
ヘッダーとデータ以外に余計なレスポンスは不要です
` },
                {
                    type: "input_image",
                    image_url: `data:image/jpeg;base64,${base64Image}`,
                },
            ],
        },
    ],
});

console.log(response)
console.log(response.output_text);
import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

async function test() {
  try {
    const res = await client.chat.send({
      chatRequest: {
        model: "baidu/cobuddy:free",
        messages: [{ role: "user", content: "hi" }]
      }
    });
    console.log('[USAGE TEST] Full response keys:', Object.keys(res));
    console.log('[USAGE TEST] Usage:', res.usage);
    console.log('[USAGE TEST] Choices[0] Keys:', Object.keys(res.choices[0]));
  } catch (e) {
    console.error('[USAGE TEST] Failed:', e.message);
  }
}
test();

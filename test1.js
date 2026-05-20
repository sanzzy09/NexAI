import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

console.log('[TEST1] Starting simple chat test...');
console.log('[TEST1] API Key configured: ' + !!process.env.OPENROUTER_API_KEY);

async function test() {
  try {
    const res = await client.chat.send({
      model: "baidu/cobuddy:free",
      messages: [{ role: "user", content: "hi" }]
    });
    console.log('[TEST1] Response received:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('[TEST1] Error:', e.message);
  }
}
test();

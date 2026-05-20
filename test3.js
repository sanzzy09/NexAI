import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
import { toolDefinitions } from "./src/tools/index.js";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

console.log('[TEST3] Starting Gemini model test...');
console.log('[TEST3] Model: google/gemini-2.0-flash-lite-preview-02-05:free');

async function test() {
  console.log('[TEST3] Sending request to Gemini model...');
  try {
    const res = await client.chat.send({
      chatRequest: {
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{ role: "user", content: "Create a new file test.js in download folder" }],
        tools: toolDefinitions
      }
    });
    console.log('[TEST3] Response:', JSON.stringify(res, null, 2));
  } catch(e) {
    console.error('[TEST3] Error:', e.message);
  }
}
test();

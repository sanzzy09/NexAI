import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
import { toolDefinitions } from "./src/tools/index.js";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

console.log('[TEST2] Starting tool-use test...');

async function test() {
  console.log('[TEST2] Sending request...');
  const res = await client.chat.send({
    chatRequest: {
      model: "baidu/cobuddy:free",
      messages: [{ role: "user", content: "Create a new file test.js in download folder" }],
      tools: toolDefinitions
    }
  });
  console.log('[TEST2] Response:', JSON.stringify(res, null, 2));
}
test();

import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
import { toolDefinitions } from "./src/tools/index.js";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

console.log('[TEST] Starting SDK test...');
console.log('[TEST] API Key: ' + (process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set'));
console.log('[TEST] Model: baidu/cobuddy:free');

async function test() {
  console.log('[TEST] Sending request...');
  try {
    const res = await client.chat.send({
      chatRequest: {
        model: "baidu/cobuddy:free",
        messages: [{ role: "user", content: "Create a new file test.js in download folder" }],
        tools: toolDefinitions
      }
    });

    console.log('[TEST] Response received');
    console.log('[TEST] Response choices:', JSON.stringify(res.choices, null, 2));
    const choice = res.choices[0].message;
    console.log('[TEST] Choice toolCalls:', choice.toolCalls);

    if (choice.toolCalls && choice.toolCalls.length > 0) {
      const toolCall = choice.toolCalls[0];
      
      console.log('[TEST] Sending tool output back...');
      const secondRes = await client.chat.send({
        chatRequest: {
          model: "baidu/cobuddy:free",
          messages: [
            { role: "user", content: "Create a new file test.js in download folder" },
            choice,
            {
              role: "tool",
              toolCallId: toolCall.id,
              content: JSON.stringify({ success: true, message: "File created successfully at download/test.js" })
            }
          ],
          tools: toolDefinitions
        }
      });
      console.log('[TEST] Second response:', JSON.stringify(secondRes.choices, null, 2));
    }
  } catch (e) {
    console.error('[TEST] Test failed with error:', e.message);
    console.error('[TEST] Stack:', e.stack);
  }
}
test();

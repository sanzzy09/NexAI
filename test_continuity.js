import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const model = "baidu/cobuddy:free";

async function run() {
  console.log('[TEST] Starting continuity test...');
  const messages = [
    { role: "system", content: "You are a helpful coding assistant." }
  ];

  // Turn 1
  console.log('\n--- Turn 1 ---');
  messages.push({ role: "user", content: "Hello! My name is NexAI. What is your name?" });
  try {
    const res1 = await client.chat.send({
      chatRequest: {
        model,
        messages,
        temperature: 0.3
      }
    });
    console.log('Turn 1 Response choice:', JSON.stringify(res1.choices[0].message, null, 2));
    messages.push(res1.choices[0].message);

    // Turn 2
    console.log('\n--- Turn 2 ---');
    messages.push({ role: "user", content: "What did I say my name was?" });
    
    console.log('Sending messages for Turn 2:', JSON.stringify(messages, null, 2));
    
    const res2 = await client.chat.send({
      chatRequest: {
        model,
        messages,
        temperature: 0.3
      }
    });
    console.log('Turn 2 Response:', JSON.stringify(res2.choices[0].message, null, 2));
  } catch (e) {
    console.error('Error during test:', e.message);
    console.error(e.stack);
  }
}

run();

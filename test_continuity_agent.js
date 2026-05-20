import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const model = "baidu/cobuddy:free";

async function run() {
  console.log('[TEST] Starting agent-style continuity test...');
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
    
    const choice = res1.choices[0].message;
    console.log('Original choice:', JSON.stringify(choice, null, 2));
    
    // Mimic agent.js reconstruction
    const msgToPush = {
      role: "assistant"
    };
    if (choice.content !== null && choice.content !== undefined) {
      msgToPush.content = choice.content;
    }
    
    let toolCalls = choice.toolCalls || choice.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      msgToPush.toolCalls = toolCalls.map(tc => ({
        id: tc.id,
        type: tc.type || "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }));
    }

    console.log('Pushing reconstructed message:', JSON.stringify(msgToPush, null, 2));
    messages.push(msgToPush);

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

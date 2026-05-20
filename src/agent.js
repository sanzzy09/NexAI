// This Code Modified By NexAI
import { OpenRouter } from "@openrouter/sdk";
import { config } from "./config.js";
import { ui } from "./ui.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { MemorySystem } from "./memory.js";
import { PromptGuard, Action } from "./safety/prompt-guard.js";
import { HealthCheckSystem } from "./health-check.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Agent {
  constructor() {
    this.client = new OpenRouter({
      apiKey: config.openrouterApiKey
    });
    this.messages = [];
    this.totalToolCalls = 0;
    this.sessionStartTime = Date.now();
    this.memory = new MemorySystem();
    this.promptGuard = new PromptGuard({
      sensitivity: config.safetySensitivity,
      canaryTokens: config.canaryTokens
    });
    this.sessionPromptTokens = 0;
    this.sessionCompletionTokens = 0;
    this.sessionTotalTokens = 0;
    this._debugMode = false;
    ui.logSessionStart();
  }

  /** Rebuild the OpenRouter client (e.g. after API key change) */
  rebuildClient() {
    this.client = new OpenRouter({
      apiKey: config.openrouterApiKey
    });
  }

  /** Rebuild the PromptGuard (e.g. after sensitivity change) */
  rebuildSafety() {
    this.promptGuard = new PromptGuard({
      sensitivity: config.safetySensitivity,
      canaryTokens: config.canaryTokens
    });
  }

  get debugMode() {
    return this._debugMode;
  }

  set debugMode(val) {
    this._debugMode = val;
  }

  async initialize() {
    try {
      // Initialize memory system
      const memInitialized = await this.memory.initialize();
      if (memInitialized) {
        ui.printInfo('[MEMORY] Memory system initialized');
        const summary = this.memory.getMemorySummary();
        ui.printInfo(`[MEMORY] Sessions: ${summary.sessionCount}, Messages: ${summary.totalMessages}, Insights: ${summary.insightsCount}`);
      }

      const skillPath = path.join(__dirname, '..', 'SKILL.md');
      const systemPrompt = await fs.readFile(skillPath, 'utf8');
      
      // Build enhanced system prompt with memory
      let enhancedPrompt = systemPrompt;
      
      // Add memory capabilities to system prompt
      enhancedPrompt += '\n\n## Memory & Learning Capabilities\n';
      enhancedPrompt += '- You have access to persistent memory tools. Use memory_save to store key information.';
      enhancedPrompt += '- Use memory_learn to save insights and patterns from conversations.';
      enhancedPrompt += '- Use memory_recall to search through saved memories when relevant.';
      enhancedPrompt += '- Use memory_summary to see an overview of all saved memories.';
      enhancedPrompt += '- You can learn from conversations: remember user preferences, names, project patterns.';
      enhancedPrompt += '- Reference previous learnings when they are relevant to the current conversation.';
      
      this.messages.push({ role: "system", content: enhancedPrompt });
      ui.printInfo('[INIT] System prompt loaded from SKILL.md with memory capabilities');
      ui.printDebug(`[INIT] System prompt length: ${enhancedPrompt.length} chars`);
    } catch (e) {
      ui.printWarning("[INIT] Could not load SKILL.md. Using default system prompt.");
      this.messages.push({ role: "system", content: "You are NEX AI, a helpful coding assistant with memory capabilities." });
    }
  }

  async chat(userMessage) {
    ui.printUser(userMessage);
    
    // Safety scanning of user input
    const safetyResult = this.promptGuard.analyze(userMessage);
    if (safetyResult.action === Action.BLOCK || safetyResult.action === Action.BLOCK_NOTIFY) {
      ui.printSafetyAlert(safetyResult, userMessage);
      return;
    }
    
    // Save user message to memory
    this.memory.addChatMessage('user', userMessage);
    
    this.messages.push({ role: "user", content: userMessage });
    
    // Safety check for history
    if (this.messages.length > 50) {
      ui.printWarning('[HISTORY] Message history exceeds 50, trimming...');
      this.messages = [this.messages[0], ...this.messages.slice(-40)];
    }

    // Check if we should add relevant memories to context
    const relevantMemories = this.memory.getRelevantMemories(userMessage);
    if (relevantMemories.length > 0) {
      ui.printDebug(`[MEMORY] Found ${relevantMemories.length} relevant memories`);
      const memContext = relevantMemories.map(m => `[Memory] ${m.insight}`).join('\n');
      this.messages.push({ role: "system", content: `Relevant memories:\n${memContext}` });
    }

    ui.logRequest(config.model, this.messages.length);

    let isDone = false;
    let iteration = 0;

    while (!isDone) {
      iteration++;
      ui.printDebug(`[LOOP] Iteration ${iteration}`);
      const spinner = ui.createSpinner("Thinking...").start();
      
      try {
        const startTime = Date.now();
        const completion = await this.client.chat.send({
          chatRequest: {
            model: config.model,
            messages: this.messages,
            tools: toolDefinitions,
            temperature: config.temperature,
            max_tokens: config.maxTokens
          }
        });
        const responseTime = Date.now() - startTime;
        spinner.stop();
        ui.logResponse(config.model, completion.choices?.[0]?.message?.toolCalls);
        ui.printDebug(`[API] Response time: ${responseTime}ms`);

        if (!completion.choices || completion.choices.length === 0) {
          ui.printError("[API] No response from model.");
          break;
        }

        const choice = completion.choices[0].message;
        
        let toolCalls = choice.toolCalls || choice.tool_calls;
        
        // Handle older function_call format just in case
        if (choice.function_call && (!toolCalls || toolCalls.length === 0)) {
          toolCalls = [{
            id: "call_" + Math.random().toString(36).substr(2, 9),
            type: "function",
            function: choice.function_call
          }];
        }

        const msgToPush = {
          role: "assistant"
        };
        
        let assistantContent = choice.content;
        if (assistantContent) {
          // Output DLP sanitization
          const dlpResult = this.promptGuard.sanitizeOutput(assistantContent);
          if (dlpResult.blocked) {
            assistantContent = "Response blocked: contains sensitive data that cannot be safely redacted.";
          } else {
            if (dlpResult.wasModified) {
              ui.printWarning(`[SAFETY] Redacted ${dlpResult.redactionCount} sensitive items from response.`);
              assistantContent = dlpResult.sanitizedText;
            }
          }
          msgToPush.content = assistantContent;
        }

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

        this.messages.push(msgToPush);

        if (assistantContent) {
          ui.printAI(assistantContent);
          if (completion.usage) {
            this.sessionPromptTokens += completion.usage.prompt_tokens || completion.usage.promptTokens || 0;
            this.sessionCompletionTokens += completion.usage.completion_tokens || completion.usage.completionTokens || 0;
            this.sessionTotalTokens += completion.usage.total_tokens || completion.usage.totalTokens || 0;
            ui.printTokenUsage(completion.usage);
          }
          
          // Save assistant response to memory
          this.memory.addChatMessage('assistant', assistantContent);
          
          // Extract learning from the exchange
          this.memory.extractLearning(userMessage, assistantContent);
        }
        
        // Debug output if model returns completely empty
        if (!choice.content && (!toolCalls || toolCalls.length === 0)) {
           ui.printError("[API] Model returned an empty response. Here is the raw API output:");
           console.log(JSON.stringify(completion, null, 2));
           isDone = true;
           continue;
        }

        if (toolCalls && toolCalls.length > 0) {
          // Model wants to use tools
          for (const toolCall of toolCalls) {
            const toolStart = Date.now();
            let argsObj;
            try {
              argsObj = JSON.parse(toolCall.function.arguments);
            } catch(e) {
              argsObj = toolCall.function.arguments;
            }
            ui.printToolCall(toolCall.function.name, argsObj);
            
            const resultStr = await executeTool(toolCall);
            const toolDuration = Date.now() - toolStart;
            ui.printToolResult(toolCall.function.name, resultStr);
            ui.logToolExecution(toolCall.function.name, toolDuration);
            this.totalToolCalls++;
            
            this.messages.push({
              role: "tool",
              toolCallId: toolCall.id,
              content: resultStr
            });
          }
          // Continue loop to send tool results back to model
        } else {
          isDone = true;
        }

      } catch (error) {
        spinner.stop();
        ui.printError(`[API] Error: ${error.message}`);
        ui.printDebug(`[API] Error stack: ${error.stack}`);
        // Remove the user message that caused the error so they can try again
        this.messages.pop(); 
        break;
      }
    }

    // Save memory after chat
    await this.memory.save();
    
    ui.printDebug(`[CHAT] Chat completed. Total tool calls this session: ${this.totalToolCalls}`);
  }

  clearHistory() {
    const sysPrompt = this.messages[0];
    this.messages = [sysPrompt];
    this.memory.clearMemory();
    ui.logHistoryCleared();
  }

  async getSessionStats() {
    const duration = Date.now() - this.sessionStartTime;
    const memSummary = this.memory.getMemorySummary();
    const memUsage = process.memoryUsage();

    let gitBranch = 'N/A';
    let gitModifiedCount = 0;
    try {
      gitBranch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'N/A';
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      gitModifiedCount = statusOutput ? statusOutput.split('\n').filter(Boolean).length : 0;
    } catch (e) {
      // Git not installed or not a git repo - ignore and fallback gracefully
    }

    let promptRate = 0.15;
    let completionRate = 0.60;
    const activeModel = config.model || '';
    if (activeModel.includes(':free') || activeModel.includes('/free')) {
      promptRate = 0;
      completionRate = 0;
    } else if (activeModel.includes('gemini-2.5-flash')) {
      promptRate = 0.075;
      completionRate = 0.30;
    }
    const estimatedCost = (this.sessionPromptTokens * promptRate + this.sessionCompletionTokens * completionRate) / 1000000;

    return {
      messages: this.messages.length,
      toolCalls: this.totalToolCalls,
      duration: `${Math.round(duration / 1000)}s`,
      memory: memSummary,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      // Dashboard dynamic statistics
      promptTokens: this.sessionPromptTokens,
      completionTokens: this.sessionCompletionTokens,
      totalTokens: this.sessionTotalTokens,
      estimatedCost: estimatedCost.toFixed(5),
      gitBranch,
      gitModifiedCount,
      activeModel,
      safetySensitivity: config.safetySensitivity
    };
  }

  /**
   * Get conversation history (excluding system prompt)
   */
  getConversationHistory() {
    return this.messages.filter(m => m.role !== 'system');
  }

  /**
   * Export conversation to a file
   */
  async exportConversation(filePath) {
    const history = this.getConversationHistory();
    const exportData = {
      exportedAt: new Date().toISOString(),
      model: config.model,
      totalMessages: history.length,
      conversation: history
    };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    return filePath;
  }

  /**
   * Run full system health and connectivity check
   * This Code Modified By NexAI
   */
  async checkSystem() {
    const health = new HealthCheckSystem(this);
    return await health.runAll();
  }

  /**
   * Factory reset — clear memory and optionally reset API key
   */
  async factoryReset(resetKey = false) {
    this.clearHistory();
    this.totalToolCalls = 0;
    this.sessionStartTime = Date.now();

    if (resetKey) {
      config.openrouterApiKey = '';
    }

    return true;
  }
}

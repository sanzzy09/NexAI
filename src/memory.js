// This File Generate By NexAi
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_DIR = path.join(__dirname, '..', '.memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.json');
const CHAT_HISTORY_FILE = path.join(MEMORY_DIR, 'chat_history.json');
const LEARNED_PATTERNS_FILE = path.join(MEMORY_DIR, 'learned_patterns.json');

export class MemorySystem {
  constructor() {
    this.memory = {
      userPreferences: {},
      learnedInsights: [],
      patterns: [],
      context: [],
      sessionCount: 0,
      lastSession: null,
      totalMessages: 0
    };
    this.chatHistory = [];
    this.loaded = false;
  }

  async initialize() {
    try {
      await fs.mkdir(MEMORY_DIR, { recursive: true });
      
      // Load memory if exists
      try {
        const memData = await fs.readFile(MEMORY_FILE, 'utf8');
        this.memory = JSON.parse(memData);
        this.loaded = true;
      } catch {
        // Fresh memory
        this.memory = {
          userPreferences: {},
          learnedInsights: [],
          patterns: [],
          context: [],
          sessionCount: 0,
          lastSession: null,
          totalMessages: 0
        };
      }

      // Load chat history
      try {
        const histData = await fs.readFile(CHAT_HISTORY_FILE, 'utf8');
        this.chatHistory = JSON.parse(histData);
      } catch {
        this.chatHistory = [];
      }

      // Load learned patterns
      try {
        const patData = await fs.readFile(LEARNED_PATTERNS_FILE, 'utf8');
        this.memory.patterns = JSON.parse(patData);
      } catch {
        this.memory.patterns = [];
      }

      this.memory.sessionCount++;
      this.memory.lastSession = new Date().toISOString();
      
      return true;
    } catch (e) {
      console.error('[MEMORY] Failed to initialize:', e.message);
      return false;
    }
  }

  async save() {
    try {
      await fs.writeFile(MEMORY_FILE, JSON.stringify(this.memory, null, 2));
      await fs.writeFile(CHAT_HISTORY_FILE, JSON.stringify(this.chatHistory.slice(-100), null, 2));
      await fs.writeFile(LEARNED_PATTERNS_FILE, JSON.stringify(this.memory.patterns, null, 2));
    } catch (e) {
      console.error('[MEMORY] Failed to save:', e.message);
    }
  }

  addChatMessage(role, content, toolCalls = null) {
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      toolCalls
    };
    this.chatHistory.push(msg);
    this.memory.totalMessages++;
    
    // Keep only last 200 messages in history
    if (this.chatHistory.length > 200) {
      this.chatHistory = this.chatHistory.slice(-200);
    }
  }

  addInsight(insight) {
    const entry = {
      insight,
      timestamp: new Date().toISOString(),
      source: 'conversation'
    };
    this.memory.learnedInsights.push(entry);
    
    // Keep last 50 insights
    if (this.memory.learnedInsights.length > 50) {
      this.memory.learnedInsights = this.memory.learnedInsights.slice(-50);
    }
    
    // Also add to patterns
    this.memory.patterns.push({
      type: 'insight',
      content: insight,
      timestamp: entry.timestamp
    });
  }

  addPreference(key, value) {
    this.memory.userPreferences[key] = {
      value,
      timestamp: new Date().toISOString()
    };
  }

  getPreference(key) {
    return this.memory.userPreferences[key]?.value;
  }

  getRecentContext(count = 5) {
    return this.chatHistory.slice(-count);
  }

  getRelevantMemories(query) {
    const queryLower = query.toLowerCase();
    const relevant = [];

    // Search through learned insights
    for (const insight of this.memory.learnedInsights) {
      if (insight.insight.toLowerCase().includes(queryLower) || 
          queryLower.includes(insight.insight.toLowerCase().substring(0, 10))) {
        relevant.push(insight);
      }
    }

    // Search through patterns
    for (const pattern of this.memory.patterns) {
      if (pattern.content.toLowerCase().includes(queryLower)) {
        relevant.push({ insight: pattern.content, timestamp: pattern.timestamp, source: 'pattern' });
      }
    }

    // Search through recent chat
    const recent = this.chatHistory.slice(-20);
    for (const msg of recent) {
      if (msg.content && msg.content.toLowerCase().includes(queryLower)) {
        relevant.push({ insight: `[Recent chat] ${msg.role}: ${msg.content.substring(0, 200)}`, timestamp: msg.timestamp, source: 'chat' });
      }
    }

    return relevant.slice(0, 5);
  }

  getMemorySummary() {
    return {
      sessionCount: this.memory.sessionCount,
      totalMessages: this.memory.totalMessages,
      insightsCount: this.memory.learnedInsights.length,
      patternsCount: this.memory.patterns.length,
      preferencesCount: Object.keys(this.memory.userPreferences).length,
      lastSession: this.memory.lastSession,
      recentInsights: this.memory.learnedInsights.slice(-5).map(i => i.insight)
    };
  }

  clearMemory() {
    this.memory = {
      userPreferences: {},
      learnedInsights: [],
      patterns: [],
      context: [],
      sessionCount: 0,
      lastSession: null,
      totalMessages: 0
    };
    this.chatHistory = [];
  }

  // Extract learning from a conversation exchange
  extractLearning(userMsg, assistantMsg) {
    const userLower = userMsg.toLowerCase();
    const assistantLower = assistantMsg.toLowerCase();

    // Detect if user introduces themselves or preferences
    if (userLower.match(/my name is|call me|i prefer|i like|i usually|my favorite|set (?:my )?preference/i)) {
      const nameMatch = userMsg.match(/my name is (\w+)/i);
      if (nameMatch) {
        this.addPreference('name', nameMatch[1]);
        this.addInsight(`User's name is ${nameMatch[1]}`);
      }

      const prefMatch = userMsg.match(/i prefer (.+)/i) || userMsg.match(/i like (.+)/i);
      if (prefMatch) {
        this.addInsight(`User preference: ${prefMatch[1].trim()}`);
      }
    }

    // Detect technical preferences
    if (userLower.match(/use (?:node|python|java|go|rust|typescript)|programming language/i)) {
      const langMatch = userMsg.match(/use (node|python|java|go|rust|typescript)/i);
      if (langMatch) {
        this.addPreference('language', langMatch[1]);
        this.addInsight(`User prefers ${langMatch[1]} for development`);
      }
    }

    // Detect project patterns
    if (userLower.match(/always|usually|typically/i) && assistantLower.match(/should|recommend|best practice/i)) {
      this.addInsight(`Pattern learned: ${userMsg.substring(0, 100)}`);
    }
  }
}

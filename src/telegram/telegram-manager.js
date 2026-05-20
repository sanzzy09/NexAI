import { config } from "../config.js";
import { ui } from "../ui.js";

/**
 * Converts Markdown to Telegram-compatible HTML.
 * Escapes raw HTML tags first, then parses standard Markdown styles,
 * and finally restores stashed code blocks with appropriate escaping.
 */
export function markdownToHtml(md) {
  if (!md) return '';

  const blocks = [];
  const inlines = [];

  // 1. Stash pre/code blocks to prevent inner formatting corruption
  let text = md.replace(/```([a-zA-Z0-9+#-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = blocks.length;
    blocks.push({ lang: lang || '', code: code });
    return `\x00BLOCK_${idx}\x00`;
  });

  // 2. Stash inline code
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const idx = inlines.length;
    inlines.push(code);
    return `\x00INLINE_${idx}\x00`;
  });

  // 3. Escape HTML entities on the remaining layout text
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 4. Parse markdown styles
  // Bold: **text** or __text__
  text = text.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__([\s\S]+?)__/g, '<b>$1</b>');

  // Italic: *text* or _text_
  text = text.replace(/\*([\s\S]+?)\*/g, '<i>$1</i>');
  text = text.replace(/\b_([^_]+?)_\b/g, '<i>$1</i>');

  // Strikethrough: ~~text~~
  text = text.replace(/~~([\s\S]+?)__/g, '<s>$1</s>');

  // Headers: # Header
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Bullet lists
  text = text.replace(/^\s*[-*+]\s+(.+)$/gm, '• $1');

  // Numbered lists
  text = text.replace(/^\s*(\d+)\.\s+(.+)$/gm, '$1. $2');

  // Blockquotes
  text = text.replace(/^\s*&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 5. Restore inline code with proper escaping
  text = text.replace(/\x00INLINE_(\d+)\x00/g, (match, idx) => {
    const code = inlines[parseInt(idx)];
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<code>${escaped}</code>`;
  });

  // 6. Restore block code with proper escaping
  text = text.replace(/\x00BLOCK_(\d+)\x00/g, (match, idx) => {
    const block = blocks[parseInt(idx)];
    const escaped = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (block.lang) {
      return `<pre><code class="language-${block.lang}">${escaped}</code></pre>`;
    } else {
      return `<pre>${escaped}</pre>`;
    }
  });

  return text;
}

export class TelegramBotManager {
  constructor(agent) {
    this.agent = agent;
    this.token = config.telegramBotToken;
    this.allowedUsers = config.telegramAllowedUsers;
    this.offset = 0;
    this.isPolling = false;
    this.abortController = null;
    this.statusMessages = new Map(); // chatId -> messageId
  }

  /**
   * Starts the background Telegram polling loop if a token is configured.
   */
  async start() {
    if (!this.token) {
      ui.printInfo("[TELEGRAM] Bot is inactive (token not set in .env).");
      return;
    }
    this.isPolling = true;
    // Don't await this so it runs in the background asynchronously
    this.poll();
  }

  /**
   * Stop polling gracefully.
   */
  stop() {
    this.isPolling = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    ui.printInfo("[TELEGRAM] Bot polling loop stopped.");
  }

  /**
   * Long polling fetch loop.
   */
  async poll() {
    ui.printInfo("[TELEGRAM] Initializing secure Telegram bot...");
    
    // Verify bot identity
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          ui.printInfo(`[TELEGRAM] Bot is active: @${data.result.username}`);
        }
      }
    } catch (e) {
      ui.printWarning(`[TELEGRAM] Could not reach Telegram server during start: ${e.message}`);
    }

    let errorCount = 0;
    while (this.isPolling) {
      this.abortController = new AbortController();
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset: this.offset,
            timeout: 30
          }),
          signal: this.abortController.signal
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.description || 'Unknown error');
        }

        errorCount = 0; // Reset error counts
        const updates = data.result || [];
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          await this.processUpdate(update);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          continue;
        }
        errorCount++;
        const backoffTime = Math.min(2000 * Math.pow(2, errorCount - 1), 30000);
        ui.printWarning(`[TELEGRAM] Connection issue: ${err.message}. Retrying in ${backoffTime / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  /**
   * Evaluate access control and route commands/messages.
   */
  async processUpdate(update) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const from = message.from;
    const messageText = message.text.trim();
    const sessionId = `telegram_${chatId}`;

    // Security shield & access control allowlist verification
    if (!this.isAuthorized(from)) {
      ui.printWarning(`[TELEGRAM] Unauthorized access attempt by ${from.first_name || ''} (@${from.username || ''}, ID: ${from.id})`);
      
      const disclaimer = `⚠️ <b>Access Denied</b>\n\nYou are not authorized to access this assistant.\n\nTo grant access, please add your ID <code>${from.id}</code> to <code>TELEGRAM_ALLOWED_USERS</code> in your <code>.env</code> file.`;
      await this.sendSingleMessage(chatId, disclaimer, { reply_markup: { remove_keyboard: true } });
      return;
    }

    // Commands Routing
    if (messageText.startsWith('/') || ['💬 Chat', '📊 Status', '⚙️ Active Model', '🧹 Clear Chat', '📖 Help'].includes(messageText)) {
      await this.handleCommand(chatId, messageText, sessionId);
      return;
    }

    // Chat processing loop
    let statusMessageId = null;
    let typingInterval = null;

    // Send typing action every 4 seconds
    this.sendChatAction(chatId, 'typing');
    typingInterval = setInterval(() => {
      this.sendChatAction(chatId, 'typing');
    }, 4000);

    const onFeedback = async (event, data) => {
      try {
        if (event === 'thinking') {
          if (!statusMessageId) {
            statusMessageId = await this.sendSingleMessage(chatId, "⚡ <i>NEX AI is thinking...</i>");
          } else {
            await this.editMessageText(chatId, statusMessageId, "⚡ <i>NEX AI is thinking...</i>");
          }
        } else if (event === 'tool_call') {
          const text = `🔧 <i>Running tool:</i> <code>${data.name}</code>...`;
          if (statusMessageId) {
            await this.editMessageText(chatId, statusMessageId, text);
          } else {
            statusMessageId = await this.sendSingleMessage(chatId, text);
          }
        } else if (event === 'safety_blocked') {
          if (statusMessageId) {
            await this.deleteMessage(chatId, statusMessageId);
            statusMessageId = null;
          }
        }
      } catch (e) {
        // Suppress callback failures
      }
    };

    try {
      const response = await this.agent.chat(messageText, sessionId, onFeedback);
      if (typingInterval) clearInterval(typingInterval);

      if (statusMessageId) {
        await this.deleteMessage(chatId, statusMessageId);
      }

      await this.sendMessage(chatId, response);
    } catch (error) {
      if (typingInterval) clearInterval(typingInterval);
      if (statusMessageId) {
        await this.deleteMessage(chatId, statusMessageId);
      }
      await this.sendMessage(chatId, `❌ <b>An error occurred:</b> ${error.message}`);
    }
  }

  /**
   * Check if a Telegram user is authorized on our allowlist.
   */
  isAuthorized(from) {
    if (!from) return false;
    if (this.allowedUsers.length === 0) return false; // Lock completely if not configured

    const userId = String(from.id);
    const username = from.username ? String(from.username).toLowerCase() : '';

    return this.allowedUsers.some(allowed => {
      const allowedClean = String(allowed).trim().toLowerCase();
      return allowedClean === userId || (username && allowedClean === username);
    });
  }

  /**
   * Router for slash commands and custom keyboard options.
   */
  async handleCommand(chatId, commandText, sessionId) {
    const textLower = commandText.toLowerCase();

    if (textLower === '/start' || commandText === '💬 Chat') {
      const welcome = `👋 <b>Welcome to NEX AI Remote Assistant!</b>\n\nI am your secure, remote coding and administration assistant connected directly to your developer environment.\n\n<b>How to use me:</b>\n• Just send any regular message to chat with me or run coding tasks!\n• Use the bottom menu keyboard or slash commands below to manage the assistant.`;
      await this.sendMessage(chatId, welcome);
    } else if (textLower === '/status' || commandText === '📊 Status') {
      this.sendChatAction(chatId, 'typing');
      try {
        const stats = await this.agent.getSessionStats();
        const text = `📊 <b>NEX AI System Status & Metrics</b>\n\n• <b>Active Model:</b> <code>${stats.activeModel}</code>\n• <b>Session Duration:</b> <code>${stats.duration}</code>\n• <b>Tokens Used:</b> <code>${stats.totalTokens}</code> (Est. Cost: <code>$${stats.estimatedCost}</code>)\n• <b>Tool Calls Executed:</b> <code>${stats.toolCalls}</code>\n• <b>Memory Insights:</b> <code>${stats.memory.insightsCount}</code>\n\n<b>Developer Host Metrics:</b>\n• <b>Git Branch:</b> <code>${stats.gitBranch}</code>\n• <b>Modified Files:</b> <code>${stats.gitModifiedCount}</code>\n• <b>Host Memory Usage:</b> <code>${stats.heapUsedMB} MB</code> / <code>${stats.heapTotalMB} MB</code>\n• <b>Safety Sensitivity:</b> <code>${stats.safetySensitivity}</code>`;
        await this.sendMessage(chatId, text);
      } catch (err) {
        await this.sendMessage(chatId, `❌ <b>Failed to fetch system stats:</b> ${err.message}`);
      }
    } else if (textLower.startsWith('/model') || commandText === '⚙️ Active Model') {
      const parts = commandText.split(/\s+/);
      if (parts.length > 1) {
        const newModel = parts[1];
        config.model = newModel;
        this.agent.rebuildClient();
        await this.sendMessage(chatId, `✅ <b>Active Model Updated:</b> <code>${newModel}</code>`);
      } else {
        await this.sendMessage(chatId, `⚙️ <b>Active Model:</b> <code>${config.model}</code>\n\nTo change the active model, send <code>/model &lt;model_name&gt;</code>.`);
      }
    } else if (textLower === '/clear' || commandText === '🧹 Clear Chat') {
      this.agent.clearHistory(sessionId);
      await this.sendMessage(chatId, "🧹 <b>Chat history for this session has been cleared!</b> Persistent memories remain intact.");
    } else if (textLower === '/help' || commandText === '📖 Help') {
      const helpText = `📖 <b>NEX AI Remote Assistant Help Guide</b>\n\nYou can use the following commands directly or via the bottom menu:\n\n• <code>/start</code> - Show welcome onboarding instructions.\n• <code>/status</code> - Query system host status, active model, and memory statistics.\n• <code>/model</code> - Show or change the active OpenRouter model.\n• <code>/clear</code> - Clear message history for the current Telegram session.\n• <code>/help</code> - Show this commands guide.\n\n<b>Interactive Tools:</b>\nYou can type any request that requires executing local tools, such as:\n• <i>"show recent git logs"</i>\n• <i>"run health check"</i>\n• <i>"search for files containing OpenRouter"</i>`;
      await this.sendMessage(chatId, helpText);
    } else {
      await this.sendMessage(chatId, `❓ <b>Unknown Command:</b> <code>${commandText}</code>. Send <code>/help</code> for a list of available commands.`);
    }
  }

  /**
   * Helper that chunks long strings and decorates them with custom keyboard.
   */
  async sendMessage(chatId, text, options = {}) {
    const defaultKeyboard = {
      keyboard: [
        [{ text: "💬 Chat" }, { text: "📊 Status" }],
        [{ text: "⚙️ Active Model" }, { text: "🧹 Clear Chat" }],
        [{ text: "📖 Help" }]
      ],
      resize_keyboard: true
    };

    const replyMarkup = options.reply_markup || defaultKeyboard;
    const CHUNK_SIZE = 4000;

    if (text.length > CHUNK_SIZE) {
      const chunks = [];
      let current = text;
      while (current.length > 0) {
        if (current.length <= CHUNK_SIZE) {
          chunks.push(current);
          break;
        }
        let splitIdx = current.lastIndexOf('\n', CHUNK_SIZE);
        if (splitIdx === -1 || splitIdx < CHUNK_SIZE - 200) {
          splitIdx = CHUNK_SIZE;
        }
        chunks.push(current.substring(0, splitIdx));
        current = current.substring(splitIdx);
      }

      for (let i = 0; i < chunks.length; i++) {
        await this.sendSingleMessage(chatId, chunks[i], {
          ...options,
          reply_markup: i === chunks.length - 1 ? replyMarkup : undefined
        });
      }
    } else {
      await this.sendSingleMessage(chatId, text, {
        ...options,
        reply_markup: replyMarkup
      });
    }
  }

  /**
   * Sends a single message block using HTML or fallback plain text formatting.
   * Returns message_id if successful.
   */
  async sendSingleMessage(chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    
    // 1. Try sending with HTML parser
    try {
      const htmlText = markdownToHtml(text);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
          ...options
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.result.message_id;
      }
      const errData = await res.json();
      ui.printWarning(`[TELEGRAM] HTML send issue: ${errData.description}. Retrying with plain text.`);
    } catch (e) {
      ui.printWarning(`[TELEGRAM] HTML parser error: ${e.message}. Retrying with plain text.`);
    }

    // 2. Fallback to clean plain text (HTML entities escaped)
    try {
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: escapedText,
          parse_mode: 'HTML',
          ...options
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.result.message_id;
      }
      const errData = await res.json();
      throw new Error(errData.description || 'Unknown error');
    } catch (err) {
      ui.printError(`[TELEGRAM] Error sending fallback plain text: ${err.message}`);
      return null;
    }
  }

  /**
   * Edits the text of an existing Telegram message.
   */
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `https://api.telegram.org/bot${this.token}/editMessageText`;
    try {
      const htmlText = markdownToHtml(text);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: htmlText,
          parse_mode: 'HTML',
          ...options
        })
      });
      if (res.ok) return true;
    } catch (e) {
      // ignore
    }

    try {
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: escapedText,
          parse_mode: 'HTML',
          ...options
        })
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Deletes an existing Telegram message.
   */
  async deleteMessage(chatId, messageId) {
    const url = `https://api.telegram.org/bot${this.token}/deleteMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Triggers chat actions like "typing".
   */
  async sendChatAction(chatId, action) {
    const url = `https://api.telegram.org/bot${this.token}/sendChatAction`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          action: action
        })
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}

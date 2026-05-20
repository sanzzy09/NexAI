// This File Generate By NexAI
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import {
  ui,
  drawDoubleBoxHeader,
  drawDoubleBoxRow,
  drawDoubleBoxSeparator,
  drawDoubleBoxFooter
} from './ui.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHECK_PASS = '✔';
const CHECK_FAIL = '✗';
const CHECK_WARN = '⚠';

/**
 * Pre-flight system health checker.
 * Runs ALL checks before the user can interact with the agent.
 * If any critical check fails, the process exits with a clear error.
 */
export class HealthCheckSystem {
  constructor(agent) {
    this.agent = agent;
    this.results = [];
    this.criticalFailed = false;
    this.startTime = Date.now();
  }

  /**
   * Run every health check and return true only if all critical checks pass.
   */
  async runAll() {
    console.log('');
    console.log(drawDoubleBoxHeader('NEX AI — SYSTEM HEALTH CHECK', chalk.cyan, 78));
    console.log(drawDoubleBoxRow('🔍  Pre-flight system checks and connection diagnostics...', chalk.cyan, 78));
    console.log(drawDoubleBoxFooter(chalk.cyan, 78));
    console.log('');

    // ── 1. Environment & Config ──────────────────────────────────
    await this._section('ENVIRONMENT & CONFIG');
    await this._checkNodeVersion();
    await this._checkEnvFile();
    await this._checkConfigValues();

    // ── 2. API Key Validation ────────────────────────────────────
    await this._section('API KEY STATUS');
    await this._checkApiKey();

    // ── 3. AI Model Connectivity ─────────────────────────────────
    await this._section('AI MODEL CONNECTIVITY');
    await this._checkModelConnection();

    // ── 4. Filesystem & Permissions ──────────────────────────────
    await this._section('FILESYSTEM & PERMISSIONS');
    await this._checkWorkingDirectory();
    await this._checkMemoryDirectory();
    await this._checkSkillFile();

    // ── 5. Memory System ─────────────────────────────────────────
    await this._section('MEMORY SYSTEM');
    await this._checkMemorySystem();

    // ── 6. Tool Modules ──────────────────────────────────────────
    await this._section('TOOL MODULES');
    await this._checkToolModules();

    // ── 7. Safety System ─────────────────────────────────────────
    await this._section('SAFETY SYSTEM');
    await this._checkSafetySystem();

    // ── 8. System Resources ──────────────────────────────────────
    await this._section('SYSTEM RESOURCES');
    await this._checkSystemResources();

    // ── Summary ──────────────────────────────────────────────────
    this._printSummary();

    return !this.criticalFailed;
  }

  // ── Helper: print section header ──────────────────────────────
  _section(title) {
    ui.printInfo(`── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
  }

  // ── Helper: record a check result ─────────────────────────────
  _record(label, passed, detail = '', critical = false) {
    const icon = passed ? CHECK_PASS : (critical ? CHECK_FAIL : CHECK_WARN);
    const tag = passed ? '[PASS]' : (critical ? '[FAIL]' : '[WARN]');
    const colorFn = passed ? '\x1b[32m' : (critical ? '\x1b[31m' : '\x1b[33m');
    const reset = '\x1b[0m';

    const line = `  ${colorFn}${icon} ${tag}${reset} ${label}${detail ? ' — ' + detail : ''}`;
    console.log(line);

    this.results.push({ label, passed, detail, critical });

    if (!passed && critical) {
      this.criticalFailed = true;
    }
  }

  // ── 1a. Node.js version ───────────────────────────────────────
  async _checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    const minMajor = 18;
    this._record(
      `Node.js version`,
      major >= minMajor,
      `${version} (required >= v${minMajor})`,
      major < minMajor
    );
  }

  // ── 1b. .env file exists ──────────────────────────────────────
  async _checkEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    try {
      const content = await fs.readFile(envPath, 'utf8');
      const hasKey = content.includes('OPENROUTER_API_KEY=');
      const hasModel = content.includes('MODEL=');
      this._record('.env file exists', true, `Found at ${envPath}`);
      this._record('.env has OPENROUTER_API_KEY', hasKey, hasKey ? 'Key variable present' : 'Missing OPENROUTER_API_KEY', !hasKey);
      this._record('.env has MODEL', hasModel, hasModel ? 'Model variable present' : 'Missing MODEL (will use default)', false);
    } catch {
      this._record('.env file exists', false, 'File not found — create .env with OPENROUTER_API_KEY', true);
    }
  }

  // ── 1c. Config values ─────────────────────────────────────────
  async _checkConfigValues() {
    this._record(
      'Working directory set',
      !!config.workingDirectory,
      config.workingDirectory || 'Not set',
      !config.workingDirectory
    );
    this._record(
      'Max tokens configured',
      config.maxTokens > 0,
      `${config.maxTokens}`,
      false
    );
    this._record(
      'Temperature configured',
      config.temperature >= 0 && config.temperature <= 2,
      `${config.temperature}`,
      false
    );
  }

  // ── 2. API Key validation ─────────────────────────────────────
  async _checkApiKey() {
    const key = config.openrouterApiKey;

    if (!key) {
      this._record('API Key present', false, 'OPENROUTER_API_KEY is empty or undefined', true);
      return;
    }

    // Check format: sk-or-v1-...
    const validPrefix = key.startsWith('sk-or-v1-') || key.startsWith('sk-or-');
    this._record(
      'API Key format',
      validPrefix,
      validPrefix ? `Valid prefix (${key.substring(0, 10)}...)` : 'Unexpected format — expected sk-or-v1-...',
      !validPrefix
    );

    // Check length (basic sanity)
    const reasonableLength = key.length >= 20;
    this._record(
      'API Key length',
      reasonableLength,
      `${key.length} chars`,
      !reasonableLength
    );

    // Masked display
    const masked = key.substring(0, 12) + '••••••••••••' + key.slice(-4);
    this._record('API Key loaded', true, masked);
  }

  // ── 3. AI Model connection ────────────────────────────────────
  async _checkModelConnection() {
    const spinner = ui.createSpinner(`  Pinging OpenRouter (${config.model})...`).start();

    try {
      const start = Date.now();
      const response = await this.agent.client.chat.send({
        chatRequest: {
          model: config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          temperature: 0.1
        }
      });
      const latency = Date.now() - start;

      spinner.stop();

      if (response && response.choices && response.choices.length > 0) {
        this._record('OpenRouter API reachable', true, `Latency: ${latency}ms`);
        this._record(`Model "${config.model}" active`, true, 'Responded successfully');

        // Check usage/quota info if available
        if (response.usage) {
          const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
          this._record('API quota/usage', true, `Prompt: ${prompt_tokens}, Completion: ${completion_tokens}, Total: ${total_tokens}`);
        }
      } else {
        this._record('OpenRouter API reachable', false, 'Empty response received — model may be offline', false);
      }
    } catch (error) {
      spinner.stop();
      const msg = error.message || 'Unknown error';

      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid api key')) {
        this._record('OpenRouter API reachable', false, '401 Unauthorized — check your API key', true);
      } else if (msg.includes('429') || msg.includes('rate limit') || msg.includes('Rate limit')) {
        // Rate limit is NOT critical — the API works, just quota exhausted
        this._record('OpenRouter API reachable', true, 'API reachable but rate limited (quota exhausted for today)');
        this._record(`Model "${config.model}" status`, false, 'Rate limited — try again later or add credits', false);
      } else if (msg.includes('404') || msg.includes('not found')) {
        this._record('OpenRouter API reachable', false, `Model "${config.model}" not found (404)`, true);
      } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('network') || msg.includes('fetch')) {
        this._record('OpenRouter API reachable', false, 'Network error — check internet connection', true);
      } else {
        this._record('OpenRouter API reachable', false, msg.substring(0, 80), false);
      }
    }
  }

  // ── 4a. Working directory ─────────────────────────────────────
  async _checkWorkingDirectory() {
    try {
      const stat = await fs.stat(config.workingDirectory);
      this._record('Working directory accessible', stat.isDirectory(), config.workingDirectory);

      // Write test
      const testFile = path.join(config.workingDirectory, '.nex_write_test');
      try {
        await fs.writeFile(testFile, '');
        await fs.unlink(testFile);
        this._record('Working directory writable', true, 'Read/Write OK');
      } catch {
        this._record('Working directory writable', false, 'Cannot write to working directory', true);
      }
    } catch {
      this._record('Working directory accessible', false, config.workingDirectory, true);
    }
  }

  // ── 4b. Memory directory ──────────────────────────────────────
  async _checkMemoryDirectory() {
    const memDir = path.join(__dirname, '..', '.memory');
    try {
      await fs.mkdir(memDir, { recursive: true });
      const stat = await fs.stat(memDir);
      this._record('.memory directory', stat.isDirectory(), 'Exists and accessible');

      // Check individual memory files
      const memFiles = ['memory.json', 'chat_history.json', 'learned_patterns.json'];
      for (const f of memFiles) {
        const fPath = path.join(memDir, f);
        try {
          const content = await fs.readFile(fPath, 'utf8');
          JSON.parse(content); // validate JSON
          this._record(`  ├─ ${f}`, true, 'Valid JSON');
        } catch (e) {
          if (e.code === 'ENOENT') {
            this._record(`  ├─ ${f}`, true, 'Will be created on first use');
          } else if (e instanceof SyntaxError) {
            this._record(`  ├─ ${f}`, false, 'Corrupted JSON — will be reset', false);
          } else {
            this._record(`  ├─ ${f}`, false, e.message.substring(0, 60), false);
          }
        }
      }
    } catch (e) {
      this._record('.memory directory', false, e.message, true);
    }
  }

  // ── 4c. SKILL.md ──────────────────────────────────────────────
  async _checkSkillFile() {
    const skillPath = path.join(__dirname, '..', 'SKILL.md');
    try {
      const content = await fs.readFile(skillPath, 'utf8');
      this._record('SKILL.md loaded', content.length > 0, `${content.length} chars`);
    } catch {
      this._record('SKILL.md loaded', false, 'Not found — agent will use default prompt', false);
    }
  }

  // ── 5. Memory system ──────────────────────────────────────────
  async _checkMemorySystem() {
    if (!this.agent.memory) {
      this._record('Memory system initialized', false, 'Agent memory is null', true);
      return;
    }

    const mem = this.agent.memory;
    this._record('Memory instance created', true);

    // Check memory summary
    try {
      const summary = mem.getMemorySummary();
      this._record('Memory summary readable', true,
        `Sessions: ${summary.sessionCount}, Messages: ${summary.totalMessages}, Insights: ${summary.insightsCount}, Patterns: ${summary.patternsCount}, Preferences: ${summary.preferencesCount}`
      );
    } catch (e) {
      this._record('Memory summary readable', false, e.message, false);
    }

    // Check chat history array
    this._record('Chat history array', Array.isArray(mem.chatHistory), `${mem.chatHistory?.length || 0} messages loaded`);
  }

  // ── 6. Tool modules ───────────────────────────────────────────
  async _checkToolModules() {
    const toolNames = [
      'file_create', 'file_read', 'file_update', 'file_delete',
      'list_directory', 'search_files', 'run_command',
      'memory_save', 'memory_recall', 'memory_learn', 'memory_summary', 'memory_clear'
    ];

    // We check if the tool definitions are registered
    try {
      const { toolDefinitions } = await import('./tools/index.js');
      const registeredNames = toolDefinitions.map(t => t.function?.name || t.name);

      for (const name of toolNames) {
        const found = registeredNames.includes(name);
        this._record(`  ├─ ${name}`, found, found ? 'Registered' : 'NOT registered', !found);
      }

      this._record('Total tools registered', true, `${registeredNames.length} tools`);
    } catch (e) {
      this._record('Tool module import', false, e.message, true);
    }
  }

  // ── 7. Safety system ──────────────────────────────────────────
  async _checkSafetySystem() {
    if (!this.agent.promptGuard) {
      this._record('PromptGuard initialized', false, 'Agent promptGuard is null', false);
      return;
    }

    this._record('PromptGuard initialized', true);

    // Quick functional test
    try {
      const testResult = this.agent.promptGuard.analyze('Hello, how are you?');
      this._record('PromptGuard functional', true, `Action: ${testResult.action}`);
    } catch (e) {
      this._record('PromptGuard functional', false, e.message, false);
    }

    // Check sensitivity setting
    const sensitivity = config.safetySensitivity || 'medium';
    const validSensitivity = ['low', 'medium', 'high'].includes(sensitivity);
    this._record('Safety sensitivity', validSensitivity, sensitivity);
  }

  // ── 8. System resources ───────────────────────────────────────
  async _checkSystemResources() {
    // Memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    this._record('Heap memory', true, `${heapUsedMB}MB / ${heapTotalMB}MB`);
    this._record('RSS memory', true, `${rssMB}MB`);

    // Uptime
    const uptimeSec = Math.round(process.uptime());
    this._record('Process uptime', true, `${uptimeSec}s`);

    // Platform
    this._record('Platform', true, `${process.platform} (${process.arch})`);

    // Free system memory (if available)
    try {
      if (process.platform !== 'win32') {
        const { execSync } = await import('child_process');
        const freeMem = execSync('free -m 2>/dev/null | awk \'NR==2{print $7}\'', { encoding: 'utf8' }).trim();
        if (freeMem) {
          this._record('System free memory', true, `${freeMem}MB available`);
        }
      }
    } catch {
      // Non-critical, skip
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  _printSummary() {
    const elapsed = Date.now() - this.startTime;
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed && r.critical).length;
    const warnings = this.results.filter(r => !r.passed && !r.critical).length;

    const color = this.criticalFailed ? chalk.red : (warnings > 0 ? chalk.yellow : chalk.green);

    console.log('');
    console.log(drawDoubleBoxHeader('CHECK SUMMARY', color, 78));
    console.log(drawDoubleBoxRow(`Total checks:   ${total}`, color, 78));
    console.log(drawDoubleBoxRow(`Passed:         ${passed}`, color, 78));
    console.log(drawDoubleBoxRow(`Warnings:       ${warnings}`, color, 78));
    console.log(drawDoubleBoxRow(`Critical fails: ${failed}`, color, 78));
    console.log(drawDoubleBoxRow(`Duration:       ${elapsed}ms`, color, 78));
    console.log(drawDoubleBoxFooter(color, 78));
    console.log('');

    if (this.criticalFailed) {
      ui.printError('SYSTEM CHECK FAILED — Critical issues detected. Fix them before using NEX AI.');
      console.log('');
    } else if (warnings > 0) {
      ui.printWarning(`System ready with ${warnings} warning(s). Review warnings above.`);
      console.log('');
    } else {
      ui.printInfo('✅ All systems operational. NEX AI is ready!');
      console.log('');
    }
  }
}

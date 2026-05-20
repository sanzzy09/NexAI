// This Code Modified By NexAI
import readline from 'readline';
import { Agent } from './agent.js';
import { ui, drawBoxHeader, drawBoxRow, drawBoxSeparator, drawBoxFooter, getVisualWidth, padLine, wrapText } from './ui.js';
import { config, updateConfig, getConfigDisplay } from './config.js';
import { changelog, getLatestVersion, formatChangelog } from './changelog.js';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { execSync, exec } from 'child_process';

// ── Available models list (shared across /model and /defaultmodel) ──
const availableModels = [
  'baidu/cobuddy:free',
  'openrouter/owl-alpha',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'google/gemini-2.5-flash',
  'meta-llama/llama-3-8b-instruct:free'
];

// ── Pending input buffer for multi-line / sub-prompt flows ──────
let pendingPrompt = null; // { resolve: fn, prompt: string }

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ui.userPrompt()
  });
}

/**
 * Resolve a model input: if it's a number, map to availableModels[index].
 * Otherwise return the raw string (model name or custom).
 * @param {string} input
 * @returns {string} resolved model name
 */
function resolveModelInput(input) {
  const num = parseInt(input, 10);
  if (!isNaN(num) && num >= 1 && num <= availableModels.length) {
    return availableModels[num - 1];
  }
  // Try case-insensitive match
  const matched = availableModels.find(m => m.toLowerCase() === input.toLowerCase());
  return matched || input;
}

/**
 * Countdown timer that displays a countdown in the same line,
 * then clears the screen and shows the main UI.
 * Press Ctrl+C during countdown to skip and go straight to main UI.
 */
function countdownAndClear(seconds) {
  return new Promise((resolve) => {
    let remaining = seconds;
    let skipped = false;

    // Hide cursor during countdown
    process.stdout.write('\x1b[?25l');

    // Handle Ctrl+C during countdown — skip to main UI
    const ctrlCHandler = () => {
      skipped = true;
      clearInterval(interval);
      process.stdout.write('\x1b[?25h');
      process.stdout.write('\r\x1b[K');
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      console.clear();
      resolve();
    };

    process.on('SIGINT', ctrlCHandler);

    // Print initial countdown immediately
    process.stdout.write(`\r\x1b[K  ⏳ Memulai dalam ${remaining} detik... (Ctrl+C untuk lewati)`);
    remaining--;

    const interval = setInterval(() => {
      if (skipped) return;

      if (remaining < 0) {
        clearInterval(interval);
        process.removeListener('SIGINT', ctrlCHandler);

        // Show cursor again
        process.stdout.write('\x1b[?25h');

        // Clear the entire screen and scrollback buffer
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        console.clear();

        // Also try platform-specific clear as fallback
        try {
          if (process.platform === 'win32') {
            execSync('cls', { stdio: 'inherit', shell: true });
          } else {
            execSync('clear', { stdio: 'inherit', shell: true });
          }
        } catch {
          // Ignore
        }

        resolve();
        return;
      }

      // Clear current line and write countdown
      process.stdout.write(`\r\x1b[K  ⏳ Memulai dalam ${remaining} detik... (Ctrl+C untuk lewati)`);
      remaining--;
    }, 1000);
  });
}

/**
 * Run a shell command and return { success, stdout, stderr }.
 */
function runCmd(command, options = {}) {
  return new Promise((resolve) => {
    exec(command, { timeout: 60000, ...options }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: error ? error.message : null
      });
    });
  });
}

/**
 * GitHub Push helper — stages all, commits, and pushes to remote.
 */
async function gitPush(commitMsg, branch) {
  const results = [];

  // Check if git is initialized
  const gitCheck = await runCmd('git rev-parse --git-dir');
  if (!gitCheck.success) {
    return { success: false, error: 'Not a git repository. Run "git init" first.' };
  }

  // Check if there's a remote
  const remoteCheck = await runCmd('git remote');
  if (!remoteCheck.success || !remoteCheck.stdout) {
    return { success: false, error: 'No remote configured. Add one with: git remote add origin <url>' };
  }

  // Configure token-based auth if token is set
  if (config.githubToken) {
    const remoteUrl = (await runCmd('git remote get-url origin')).stdout;
    if (remoteUrl && remoteUrl.startsWith('https://')) {
      const tokenUrl = remoteUrl.replace('https://', `https://${config.githubToken}@`);
      await runCmd(`git remote set-url origin "${tokenUrl}"`);
      results.push({ step: 'auth', success: true, detail: 'Token-based auth configured' });
    }
  }

  // Stage all changes
  const addResult = await runCmd('git add -A');
  results.push({ step: 'add', success: addResult.success, detail: addResult.stdout || 'All changes staged' });

  // Check if there are changes to commit
  const statusCheck = await runCmd('git status --porcelain');
  if (!statusCheck.stdout) {
    return { success: true, noChanges: true, results, detail: 'Nothing to commit — working tree clean.' };
  }

  // Count staged files
  const fileCount = statusCheck.stdout.split('\n').filter(l => l.trim()).length;

  // Commit
  const safeMsg = commitMsg ? commitMsg.replace(/"/g, '\\"') : `NEX AI auto-commit: ${new Date().toISOString().substring(0, 19)}`;
  const commitResult = await runCmd(`git commit -m "${safeMsg}"`);
  results.push({ step: 'commit', success: commitResult.success, detail: commitResult.stdout || commitResult.stderr });

  if (!commitResult.success && !commitResult.stderr?.includes('nothing to commit')) {
    return { success: false, error: commitResult.stderr, results };
  }

  // Push
  const targetBranch = branch || (await runCmd('git branch --show-current')).stdout || 'main';
  const pushResult = await runCmd(`git push origin ${targetBranch}`);
  results.push({ step: 'push', success: pushResult.success, detail: pushResult.stdout || pushResult.stderr });

  if (!pushResult.success) {
    return { success: false, error: pushResult.stderr, results };
  }

  return { success: true, fileCount, branch: targetBranch, results };
}

async function main() {
  ui.showBanner();

  // ── Pre-flight: basic env check (fast, no network) ───────────
  if (!config.openrouterApiKey) {
    ui.printError("OPENROUTER_API_KEY is not set in .env file.");
    process.exit(1);
  }

  // ── Initialize agent ──────────────────────────────────────────
  const agent = new Agent();
  await agent.initialize();

  // ── Run full system health check BEFORE accepting user input ──
  // This Code Modified By NexAI
  const allOk = await agent.checkSystem();

  if (!allOk) {
    ui.printError('Startup aborted due to critical health check failures.');
    process.exit(1);
  }

  // ── Countdown 5 detik, lalu clear terminal & tampilkan UI ────
  await countdownAndClear(5);

  // ── Tampilkan tampilan utama setelah clear ────────────────────
  ui.showBanner();
  ui.printInfo(`[SYSTEM] NEX AI v${getLatestVersion()} ready. Type /help for commands.\n`);

  // ── Setup readline ────────────────────────────────────────────
  const rl = createReadlineInterface();

  let isSwitchingModel = false;

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    // ── Handle pending sub-prompts first ─────────────────────────
    if (pendingPrompt) {
      const resolve = pendingPrompt.resolve;
      const savedPrompt = pendingPrompt.prompt;
      pendingPrompt = null;
      rl.setPrompt(ui.userPrompt());

      const answer = input;
      // If user typed a command while in sub-prompt, cancel sub-prompt
      if (answer.startsWith('/')) {
        console.log('  Cancelled.');
        rl.setPrompt(ui.userPrompt());
        rl.prompt();
        // Re-dispatch the command
        rl.emit('line', answer);
        return;
      }
      resolve(answer);
      return;
    }

    // ── Model switcher sub-prompt ────────────────────────────────
    if (isSwitchingModel) {
      if (input === '') {
        console.log('  Model switch cancelled.');
      } else {
        const resolved = resolveModelInput(input);
        config.model = resolved;
        ui.printInfo(`[MODEL] Switched to model: ${resolved}`);
      }
      isSwitchingModel = false;
      rl.setPrompt(ui.userPrompt());
      rl.prompt();
      return;
    }

    if (!input) {
      rl.prompt();
      return;
    }

    // ══════════════════════════════════════════════════════════════
    //  COMMAND ROUTER
    // ══════════════════════════════════════════════════════════════

    // ── /exit ────────────────────────────────────────────────────
    if (input === '/exit' || input === '/quit') {
      ui.printInfo('[EXIT] User requested exit');
      ui.logSessionEnd();
      const stats = await agent.getSessionStats();
      ui.printInfo(`[STATS] Messages: ${stats.messages}, Tool calls: ${stats.toolCalls}, Duration: ${stats.duration}`);
      if (stats.memory) {
        ui.printInfo(`[STATS] Memory - Sessions: ${stats.memory.sessionCount}, Insights: ${stats.memory.insightsCount}, Messages: ${stats.memory.totalMessages}`);
      }
      console.log('Goodbye!');
      process.exit(0);
    }

    // ── /help ────────────────────────────────────────────────────
    else if (input === '/help') {
      console.log('');
      console.log(drawBoxHeader('📖 COMMAND LIST', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  SESSION'), chalk.cyan, 78));
      console.log(drawBoxRow('    /exit, /quit      Quit NEX AI', chalk.cyan, 78));
      console.log(drawBoxRow('    /clear            Clear conversation history & memory', chalk.cyan, 78));
      console.log(drawBoxRow('    /reset            Factory reset (clear all data)', chalk.cyan, 78));
      console.log(drawBoxRow('    /stats            Show session statistics', chalk.cyan, 78));
      console.log(drawBoxRow('', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  AI & MODEL'), chalk.cyan, 78));
      console.log(drawBoxRow('    /model [name]     View or switch active LLM model', chalk.cyan, 78));
      console.log(drawBoxRow('    /defaultmodel     Set default model (persists across sessions)', chalk.cyan, 78));
      console.log(drawBoxRow('    /apikey [key]     View or change OpenRouter API key', chalk.cyan, 78));
      console.log(drawBoxRow('    /config           View or edit configuration', chalk.cyan, 78));
      console.log(drawBoxRow('', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  MEMORY'), chalk.cyan, 78));
      console.log(drawBoxRow('    /memory           Show memory summary', chalk.cyan, 78));
      console.log(drawBoxRow('    /history          Show conversation history', chalk.cyan, 78));
      console.log(drawBoxRow('    /export [file]    Export conversation to JSON file', chalk.cyan, 78));
      console.log(drawBoxRow('', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  GITHUB'), chalk.cyan, 78));
      console.log(drawBoxRow('    /gitpush          Push current project to GitHub', chalk.cyan, 78));
      console.log(drawBoxRow('    /gittoken [token] View or change GitHub Personal Access Token', chalk.cyan, 78));
      console.log(drawBoxRow('', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  SYSTEM'), chalk.cyan, 78));
      console.log(drawBoxRow('    /health           Re-run system health check', chalk.cyan, 78));
      console.log(drawBoxRow('    /debug            Toggle debug mode (verbose logging)', chalk.cyan, 78));
      console.log(drawBoxRow('    /safety           View or change safety sensitivity', chalk.cyan, 78));
      console.log(drawBoxRow('    /changelog        Show version changelog', chalk.cyan, 78));
      console.log(drawBoxRow('', chalk.cyan, 78));
      console.log(drawBoxRow(chalk.cyan.bold('  TIPS'), chalk.cyan, 78));
      console.log(drawBoxRow('    • Type /model without args to see available models', chalk.cyan, 78));
      console.log(drawBoxRow('    • Type /apikey without args to see current key', chalk.cyan, 78));
      console.log(drawBoxRow('    • Type /gittoken without args to see current token', chalk.cyan, 78));
      console.log(drawBoxRow('    • Type /config then choose a number to edit a setting', chalk.cyan, 78));
      console.log(drawBoxRow('    • Type /reset then confirm to wipe all data', chalk.cyan, 78));
      console.log(drawBoxFooter(chalk.cyan, 78));
      console.log('');
      rl.prompt();
      return;
    }

    // ── /clear ──────────────────────────────────────────────────
    else if (input === '/clear') {
      agent.clearHistory();
      rl.prompt();
      return;
    }

    // ── /changelog ──────────────────────────────────────────────
    else if (input.startsWith('/changelog')) {
      const parts = input.split(' ');
      let limit = 0; // 0 = show all
      if (parts.length > 1 && parts[1].trim()) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > 0) {
          limit = num;
        }
      }

      // Show latest version info
      const latest = changelog.length > 0 ? changelog[0] : null;
      if (latest) {
        ui.printInfo(`[CHANGELOG] NEX AI v${latest.version} (${latest.date}) — ${latest.changes.length} changes`);
      }

      const output = formatChangelog(limit);
      console.log(output);

      if (limit > 0 && changelog.length > limit) {
        ui.printInfo(`Showing ${limit} latest version(s). Use /changelog to see all.`);
      }
      rl.prompt();
      return;
    }

    // ── /health ─────────────────────────────────────────────────
    else if (input === '/health') {
      // This Code Modified By NexAI
      await agent.checkSystem();
      rl.prompt();
      return;
    }

    // ── /debug ──────────────────────────────────────────────────
    else if (input === '/debug') {
      agent.debugMode = !agent.debugMode;
      const status = agent.debugMode ? 'ON — verbose logging enabled' : 'OFF — normal logging';
      ui.printInfo(`[DEBUG] Debug mode: ${status}`);
      rl.prompt();
      return;
    }

    // ── /stats ──────────────────────────────────────────────────
    else if (input === '/stats') {
      const stats = await agent.getSessionStats();
      console.log('');
      console.log(drawBoxHeader('📊 SESSION STATS', chalk.magenta, 78));
      console.log(drawBoxRow(`  Duration:        ${stats.duration}`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Messages:        ${stats.messages}`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Tool Calls:      ${stats.toolCalls}`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Active Model:    ${config.model}`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Heap Memory:     ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`, chalk.magenta, 78));
      console.log(drawBoxRow(`  RSS Memory:      ${stats.rssMB}MB`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Debug Mode:      ${agent.debugMode ? 'ON' : 'OFF'}`, chalk.magenta, 78));
      console.log(drawBoxRow(`  Safety Level:    ${config.safetySensitivity}`, chalk.magenta, 78));
      
      if (stats.memory) {
        console.log(drawBoxSeparator(chalk.magenta, 78));
        console.log(drawBoxRow(chalk.magenta.bold('  🧠 MEMORY'), chalk.magenta, 78));
        console.log(drawBoxRow(`  Sessions:        ${stats.memory.sessionCount}`, chalk.magenta, 78));
        console.log(drawBoxRow(`  Total Messages:  ${stats.memory.totalMessages}`, chalk.magenta, 78));
        console.log(drawBoxRow(`  Insights:        ${stats.memory.insightsCount}`, chalk.magenta, 78));
        console.log(drawBoxRow(`  Patterns:        ${stats.memory.patternsCount}`, chalk.magenta, 78));
        console.log(drawBoxRow(`  Preferences:     ${stats.memory.preferencesCount}`, chalk.magenta, 78));
      }
      console.log(drawBoxFooter(chalk.magenta, 78));
      console.log('');
      rl.prompt();
      return;
    }

    // ── /model ──────────────────────────────────────────────────
    else if (input.startsWith('/model')) {
      const parts = input.split(' ');
      if (parts.length > 1 && parts[1].trim()) {
        const resolved = resolveModelInput(parts[1].trim());
        config.model = resolved;
        ui.printInfo(`[MODEL] Switched to model: ${resolved}`);
        rl.prompt();
        return;
      }

      console.log(`\n[MODEL SWITCHER]`);
      console.log(`Current active model: ${config.model}\n`);
      console.log(`Available models:`);
      availableModels.forEach((m, idx) => {
        console.log(`  [${idx + 1}] ${m}${m === config.model ? ' ◄ active' : ''}`);
      });
      console.log(`\nType a number (1-${availableModels.length}) or a custom model name to switch, or press Enter to cancel.`);
      isSwitchingModel = true;
      rl.setPrompt('  Select model > ');
      rl.prompt();
      return;
    }

    // ── /defaultmodel ───────────────────────────────────────────
    else if (input.startsWith('/defaultmodel')) {
      const parts = input.split(' ');
      if (parts.length > 1 && parts[1].trim()) {
        // Direct set: /defaultmodel <name or number>
        // This Code Modified By NexAI — resolve number to model name
        const rawInput = parts.slice(1).join(' ').trim();
        const resolvedModel = resolveModelInput(rawInput);
        const saved = updateConfig('DEFAULT_MODEL', resolvedModel);
        if (saved) {
          config.defaultModel = resolvedModel;
          // Also switch current model to the new default
          config.model = resolvedModel;
          ui.printInfo(`[DEFAULT MODEL] Set to: ${resolvedModel}`);
          ui.printInfo(`[DEFAULT MODEL] Current model also switched to: ${resolvedModel}`);
          ui.printInfo('[DEFAULT MODEL] This will be used on next startup.');
        } else {
          ui.printError('[DEFAULT MODEL] Failed to save to .env');
        }
      } else {
        // Show current default + available models
        console.log('');
        console.log(drawBoxHeader('🎯 DEFAULT MODEL', chalk.blue, 78));
        console.log(drawBoxRow(`  Current model:    ${config.model}`, chalk.blue, 78));
        console.log(drawBoxRow(`  Default model:    ${config.defaultModel || '(same as current)'}`, chalk.blue, 78));
        console.log(drawBoxSeparator(chalk.blue, 78));
        console.log(drawBoxRow('  Available models:', chalk.blue, 78));
        availableModels.forEach((m, idx) => {
          const marker = m === config.defaultModel ? ' ★' : '';
          const line = `    [${idx + 1}] ${m}${marker}`;
          console.log(drawBoxRow(line, chalk.blue, 78));
        });
        console.log(drawBoxSeparator(chalk.blue, 78));
        console.log(drawBoxRow('  Usage:', chalk.blue, 78));
        console.log(drawBoxRow('    /defaultmodel <name>   Set default model', chalk.blue, 78));
        console.log(drawBoxRow('    /defaultmodel <number> Pick from list above', chalk.blue, 78));
        console.log(drawBoxRow('    /defaultmodel clear    Remove default (use env MODEL)', chalk.blue, 78));
        console.log(drawBoxFooter(chalk.blue, 78));
        console.log('');

        // Sub-prompt for setting default
        // This Code Modified By NexAI — resolve number to model name in sub-prompt
        pendingPrompt = {
          resolve: async (answer) => {
            if (!answer) {
              console.log('  Default model unchanged.');
              rl.prompt();
              return;
            }
            if (answer.toLowerCase() === 'clear') {
              updateConfig('DEFAULT_MODEL', '');
              config.defaultModel = '';
              ui.printInfo('[DEFAULT MODEL] Default model cleared. Will use MODEL from .env.');
              rl.prompt();
              return;
            }
            // Resolve number → model name
            const resolvedModel = resolveModelInput(answer);
            const saved = updateConfig('DEFAULT_MODEL', resolvedModel);
            if (saved) {
              config.defaultModel = resolvedModel;
              config.model = resolvedModel;
              ui.printInfo(`[DEFAULT MODEL] Set to: ${resolvedModel}`);
              ui.printInfo(`[DEFAULT MODEL] Current model switched to: ${resolvedModel}`);
            } else {
              ui.printError('[DEFAULT MODEL] Failed to save.');
            }
            rl.prompt();
          },
          prompt: ui.userPrompt()
        };
        rl.setPrompt('  Set default model > ');
        rl.prompt();
        return;
      }
      rl.prompt();
      return;
    }

    // ── /apikey ─────────────────────────────────────────────────
    else if (input.startsWith('/apikey')) {
      const parts = input.split(' ');
      if (parts.length > 1 && parts[1].trim()) {
        // Direct set: /apikey sk-or-v1-xxxxx
        const newKey = parts.slice(1).join(' ').trim();
        const saved = updateConfig('OPENROUTER_API_KEY', newKey);
        if (saved) {
          agent.rebuildClient();
          const masked = newKey.substring(0, 12) + '••••••••••••' + newKey.slice(-4);
          ui.printInfo(`[APIKEY] API key updated: ${masked}`);
          ui.printInfo('[APIKEY] OpenRouter client rebuilt with new key.');
        } else {
          ui.printError('[APIKEY] Failed to save API key to .env');
        }
      } else {
        // Show current key + prompt for new one
        const currentKey = config.openrouterApiKey || '';
        const masked = currentKey.length > 16
          ? currentKey.substring(0, 12) + '••••••••••••' + currentKey.slice(-4)
          : '(not set)';
        console.log(`\n[API KEY MANAGER]`);
        console.log(`  Current key: ${masked}`);
        console.log(`  Enter a new API key below, or press Enter to cancel.`);
        console.log(`  Format: sk-or-v1-xxxxxxxxxxxxxxxx`);
        pendingPrompt = {
          resolve: async (answer) => {
            if (!answer) {
              console.log('  API key unchanged.');
              rl.prompt();
              return;
            }
            const trimmed = answer.trim();
            if (!trimmed.startsWith('sk-or-')) {
              ui.printWarning('[APIKEY] Warning: Key does not start with "sk-or-" — may be invalid.');
            }
            const saved = updateConfig('OPENROUTER_API_KEY', trimmed);
            if (saved) {
              agent.rebuildClient();
              const m = trimmed.substring(0, 12) + '••••••••••••' + trimmed.slice(-4);
              ui.printInfo(`[APIKEY] API key updated: ${m}`);
              ui.printInfo('[APIKEY] OpenRouter client rebuilt with new key.');
            } else {
              ui.printError('[APIKEY] Failed to save API key to .env');
            }
            rl.prompt();
          },
          prompt: ui.userPrompt()
        };
        rl.setPrompt('  New API key > ');
        rl.prompt();
        return;
      }
      rl.prompt();
      return;
    }

    // ── /gittoken ───────────────────────────────────────────────
    else if (input.startsWith('/gittoken')) {
      const parts = input.split(' ');
      if (parts.length > 1 && parts[1].trim()) {
        // Direct set: /gittoken ghp_xxxxx
        const newToken = parts.slice(1).join(' ').trim();
        const saved = updateConfig('GITHUB_TOKEN', newToken);
        if (saved) {
          config.githubToken = newToken;
          const masked = newToken.substring(0, 6) + '••••••••' + newToken.slice(-4);
          ui.printInfo(`[GITHUB] Token updated: ${masked}`);
          ui.printInfo('[GITHUB] Token saved to .env — ready for git push.');
        } else {
          ui.printError('[GITHUB] Failed to save token to .env');
        }
      } else {
        // Show current token + prompt for new one
        const currentToken = config.githubToken || '';
        const masked = currentToken.length > 8
          ? currentToken.substring(0, 6) + '••••••••' + currentToken.slice(-4)
          : '(not set)';
        console.log('');
        console.log(drawBoxHeader('🔑 GITHUB TOKEN', chalk.green, 78));
        console.log(drawBoxRow(`  Current token: ${masked}`, chalk.green, 78));
        console.log(drawBoxSeparator(chalk.green, 78));
        console.log(drawBoxRow('  Enter a new token below, or press Enter to cancel.', chalk.green, 78));
        console.log(drawBoxRow('  Format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', chalk.green, 78));
        console.log(drawBoxRow('  Or: github_pat_xxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxx', chalk.green, 78));
        console.log(drawBoxFooter(chalk.green, 78));
        console.log('');

        pendingPrompt = {
          resolve: async (answer) => {
            if (!answer) {
              console.log('  Token unchanged.');
              rl.prompt();
              return;
            }
            const trimmed = answer.trim();
            if (!trimmed.startsWith('ghp_') && !trimmed.startsWith('github_pat_')) {
              ui.printWarning('[GITHUB] Warning: Token does not start with "ghp_" or "github_pat_" — may be invalid.');
            }
            const saved = updateConfig('GITHUB_TOKEN', trimmed);
            if (saved) {
              config.githubToken = trimmed;
              const m = trimmed.substring(0, 6) + '••••••••' + trimmed.slice(-4);
              ui.printInfo(`[GITHUB] Token updated: ${m}`);
              ui.printInfo('[GITHUB] Token saved to .env — ready for git push.');
            } else {
              ui.printError('[GITHUB] Failed to save token to .env');
            }
            rl.prompt();
          },
          prompt: ui.userPrompt()
        };
        rl.setPrompt('  New GitHub token > ');
        rl.prompt();
        return;
      }
      rl.prompt();
      return;
    }

    // ── /gitpush ────────────────────────────────────────────────
    else if (input.startsWith('/gitpush')) {
      const parts = input.split(' ');
      let commitMsg = null;
      let branch = null;

      // Parse: /gitpush [message] [--branch name]
      const branchIdx = parts.indexOf('--branch');
      if (branchIdx !== -1 && parts[branchIdx + 1]) {
        branch = parts[branchIdx + 1];
      }
      if (parts.length > 1 && parts[1] !== '--branch') {
        commitMsg = parts.slice(1, branchIdx === -1 ? undefined : branchIdx).join(' ').trim();
        if (!commitMsg) commitMsg = null;
      }

      // Check token
      if (!config.githubToken) {
        ui.printError('[GITHUB] No GitHub token set. Use /gittoken to set one first.');
        rl.prompt();
        return;
      }

      console.log('');
      console.log(drawBoxHeader('🚀 GIT PUSH TO GITHUB', chalk.green, 78));
      console.log(drawBoxRow('  Preparing to push...', chalk.green, 78));
      console.log(drawBoxFooter(chalk.green, 78));
      console.log('');

      const result = await gitPush(commitMsg, branch);

      if (result.noChanges) {
        ui.printInfo(`[GITHUB] ${result.detail}`);
      } else if (result.success) {
        console.log('');
        console.log(drawBoxHeader('✅ PUSH SUCCESSFUL', chalk.green, 78));
        console.log(drawBoxRow(`  Branch:  ${result.branch}`, chalk.green, 78));
        console.log(drawBoxRow(`  Files:   ${result.fileCount} changed`, chalk.green, 78));
        console.log(drawBoxFooter(chalk.green, 78));
        console.log('');
        ui.printSuccess(`Pushed ${result.fileCount} file(s) to origin/${result.branch}`);
      } else {
        ui.printError(`[GITHUB] Push failed: ${result.error}`);
        if (result.results) {
          result.results.forEach(r => {
            const icon = r.success ? '✔' : '✗';
            ui.printInfo(`  ${icon} ${r.step}: ${r.detail}`);
          });
        }
      }
      rl.prompt();
      return;
    }

    // ── /config ─────────────────────────────────────────────────
    else if (input.startsWith('/config')) {
      const parts = input.split(' ');
      if (parts.length >= 3) {
        // Direct set: /config KEY VALUE
        const key = parts[1].toUpperCase();
        const value = parts.slice(2).join(' ');
        const validKeys = ['MAX_TOKENS', 'TEMPERATURE', 'SAFETY_SENSITIVITY', 'MODEL', 'GITHUB_TOKEN', 'DEFAULT_MODEL'];
        if (!validKeys.includes(key)) {
          ui.printError(`[CONFIG] Unknown key: ${key}. Valid: ${validKeys.join(', ')}`);
        } else {
          // This Code Modified By NexAI — resolve number to model name for MODEL and DEFAULT_MODEL
          let resolvedValue = value;
          if (key === 'MODEL' || key === 'DEFAULT_MODEL') {
            resolvedValue = resolveModelInput(value);
          }
          const saved = updateConfig(key, resolvedValue);
          if (saved) {
            // Rebuild safety if sensitivity changed
            if (key === 'SAFETY_SENSITIVITY') {
              agent.rebuildSafety();
            }
            if (key === 'MODEL' || key === 'DEFAULT_MODEL') {
              ui.printInfo(`[CONFIG] ${key} = ${resolvedValue} (saved to .env)`);
            } else {
              ui.printInfo(`[CONFIG] ${key} = ${resolvedValue} (saved to .env)`);
            }
          } else {
            ui.printError(`[CONFIG] Failed to save ${key}`);
          }
        }
        rl.prompt();
        return;
      }

      // Show interactive config menu
      const display = getConfigDisplay();
      console.log('');
      console.log(drawBoxHeader('⚙️  CONFIGURATION', chalk.yellow, 78));
      console.log(drawBoxRow('  Current settings:', chalk.yellow, 78));
      console.log(drawBoxRow('', chalk.yellow, 78));
      const keys = Object.keys(display);
      keys.forEach((k, i) => {
        const item = `  [${i + 1}] ${k.padEnd(22)} ${display[k]}`;
        console.log(drawBoxRow(item, chalk.yellow, 78));
      });
      console.log(drawBoxRow('', chalk.yellow, 78));
      console.log(drawBoxSeparator(chalk.yellow, 78));
      console.log(drawBoxRow('  Usage: /config <key> <value>', chalk.yellow, 78));
      console.log(drawBoxRow('  Example: /config TEMPERATURE 0.7', chalk.yellow, 78));
      console.log(drawBoxRow('  Example: /config MAX_TOKENS 8192', chalk.yellow, 78));
      console.log(drawBoxRow('  Example: /config DEFAULT_MODEL 2', chalk.yellow, 78));
      console.log(drawBoxFooter(chalk.yellow, 78));
      console.log('');
      rl.prompt();
      return;
    }

    // ── /safety ─────────────────────────────────────────────────
    else if (input.startsWith('/safety')) {
      const parts = input.split(' ');
      if (parts.length > 1 && parts[1].trim()) {
        const newLevel = parts[1].trim().toLowerCase();
        const valid = ['low', 'medium', 'high'];
        if (!valid.includes(newLevel)) {
          ui.printError(`[SAFETY] Invalid level: ${newLevel}. Valid: ${valid.join(', ')}`);
        } else {
          const saved = updateConfig('SAFETY_SENSITIVITY', newLevel);
          if (saved) {
            agent.rebuildSafety();
            ui.printInfo(`[SAFETY] Sensitivity set to: ${newLevel}`);
          } else {
            ui.printError('[SAFETY] Failed to save safety setting');
          }
        }
      } else {
        console.log(`\n[SAFETY SYSTEM]`);
        console.log(`  Current sensitivity: ${config.safetySensitivity}`);
        console.log(`  Valid levels: low, medium, high`);
        console.log(`  Usage: /safety <level>`);
        console.log(`\n  Levels:`);
        console.log(`    low    — Minimal filtering, only block critical threats`);
        console.log(`    medium — Balanced filtering (default)`);
        console.log(`    high   — Aggressive filtering, block suspicious inputs`);
      }
      rl.prompt();
      return;
    }

    // ── /memory ─────────────────────────────────────────────────
    else if (input === '/memory') {
      const stats = await agent.getSessionStats();
      if (stats.memory) {
        console.log(`\n[MEMORY SUMMARY]`);
        console.log(`  Sessions: ${stats.memory.sessionCount}`);
        console.log(`  Total Messages: ${stats.memory.totalMessages}`);
        console.log(`  Insights Saved: ${stats.memory.insightsCount}`);
        console.log(`  Patterns Learned: ${stats.memory.patternsCount}`);
        console.log(`  Preferences: ${stats.memory.preferencesCount}`);
        if (stats.memory.recentInsights.length > 0) {
          console.log(`  Recent Insights:`);
          stats.memory.recentInsights.forEach(i => console.log(`    - ${i}`));
        }
      }
      rl.prompt();
      return;
    }

    // ── /history ────────────────────────────────────────────────
    else if (input.startsWith('/history')) {
      const parts = input.split(' ');
      const count = parts[1] ? parseInt(parts[1], 10) : 10;
      const history = agent.getConversationHistory();
      const recent = history.slice(-count);

      if (recent.length === 0) {
        console.log('\n  [HISTORY] No conversation history yet.');
      } else {
        console.log(`\n[CONVERSATION HISTORY — last ${recent.length} messages]\n`);
        recent.forEach((msg, i) => {
          const roleLabel = msg.role === 'user' ? '👤 USER' : (msg.role === 'assistant' ? '🤖 NEX AI' : '🔧 TOOL');
          const content = (msg.content || '(no content)').substring(0, 200);
          console.log(`  ${String(i + 1).padEnd(3)} ${roleLabel}:`);
          content.split('\n').forEach(l => console.log(`       ${l}`));
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            msg.toolCalls.forEach(tc => {
              console.log(`       ⚙️  ${tc.function?.name || tc.name}(${JSON.stringify(tc.function?.arguments || {}).substring(0, 80)})`);
            });
          }
          console.log('');
        });
      }
      rl.prompt();
      return;
    }

    // ── /export ─────────────────────────────────────────────────
    else if (input.startsWith('/export')) {
      const parts = input.split(' ');
      let filePath;
      if (parts.length > 1 && parts[1].trim()) {
        filePath = parts[1].trim();
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        filePath = path.join(config.workingDirectory, `nex-export-${timestamp}.json`);
      }

      // Ensure .json extension
      if (!filePath.endsWith('.json')) filePath += '.json';

      try {
        const saved = await agent.exportConversation(filePath);
        const history = agent.getConversationHistory();
        ui.printInfo(`[EXPORT] Conversation saved to: ${saved}`);
        ui.printInfo(`[EXPORT] ${history.length} messages exported.`);
      } catch (e) {
        ui.printError(`[EXPORT] Failed: ${e.message}`);
      }
      rl.prompt();
      return;
    }

    // ── /reset ──────────────────────────────────────────────────
    else if (input.startsWith('/reset')) {
      const parts = input.split(' ');
      const fullReset = parts.includes('--full');

      console.log(`\n[FACTORY RESET]`);
      if (fullReset) {
        console.log(`  This will clear ALL memory data AND remove the API key.`);
      } else {
        console.log(`  This will clear ALL conversation history and memory data.`);
      }
      console.log(`  Type "yes" to confirm, or press Enter to cancel.`);

      pendingPrompt = {
        resolve: async (answer) => {
          if (answer.toLowerCase() === 'yes') {
            await agent.factoryReset(fullReset);
            if (fullReset) {
              updateConfig('OPENROUTER_API_KEY', '');
              agent.rebuildClient();
              ui.printInfo('[RESET] Full reset complete. API key cleared.');
              ui.printInfo('[RESET] Set a new key with /apikey before chatting.');
            } else {
              ui.printInfo('[RESET] Memory and history cleared. API key preserved.');
            }
          } else {
            console.log('  Reset cancelled.');
          }
          rl.prompt();
        },
        prompt: ui.userPrompt()
      };
      rl.setPrompt('  Confirm (yes) > ');
      rl.prompt();
      return;
    }

    // ══════════════════════════════════════════════════════════════
    //  NOT A COMMAND — pass to AI agent
    // ══════════════════════════════════════════════════════════════
    await agent.chat(input);
    rl.resume();
    rl.prompt();
  }).on('close', () => {
    ui.printInfo('[EXIT] Session closed');
    ui.logSessionEnd();
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

main().catch(err => {
  ui.printError(err.message);
  ui.printDebug(err.stack);
  process.exit(1);
});

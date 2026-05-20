// This Code Modified By NexAI

/**
 * NEX AI — Changelog data.
 * Each entry: { version, date, changes: [{ type, description }] }
 * Types: added, fixed, improved, changed, removed, security
 */

export const changelog = [
  {
    version: '1.6.0',
    date: '2026-05-20',
    changes: [
      { type: 'added', description: 'Command /gittoken — view or change GitHub Personal Access Token' },
      { type: 'added', description: 'Command /gitpush — push current project to GitHub repository' },
      { type: 'added', description: 'Command /defaultmodel — set default AI model (persists across sessions)' },
      { type: 'added', description: 'GITHUB_TOKEN variable in .env for GitHub authentication' },
      { type: 'added', description: 'DEFAULT_MODEL variable in .env for persistent model preference' },
      { type: 'added', description: 'GitHub section in /help command list' },
      { type: 'improved', description: 'Config menu now shows GitHub Token and Default Model' },
      { type: 'improved', description: 'Config /config now supports GITHUB_TOKEN and DEFAULT_MODEL keys' },
    ]
  },
  {
    version: '1.5.0',
    date: '2026-05-20',
    changes: [
      { type: 'improved', description: 'Command /changelog — tampilan lebih rapi dengan box layout dan warna per tipe perubahan' },
      { type: 'improved', description: 'Countdown 5 detik setelah health check dengan clear terminal otomatis sebelum tampilan utama' },
      { type: 'fixed', description: 'Countdown sekarang bisa dibatalkan dengan Ctrl+C' },
    ]
  },
  {
    version: '1.4.0',
    date: '2026-05-20',
    changes: [
      { type: 'added', description: 'Command /changelog — menampilkan riwayat versi dan perubahan' },
      { type: 'added', description: 'Hitung mundur 5 detik setelah health check sebelum menampilkan tampilan utama' },
      { type: 'improved', description: 'Startup flow: health check → countdown → clear → main UI' },
    ]
  },
  {
    version: '1.3.0',
    date: '2026-05-20',
    changes: [
      { type: 'added', description: 'Command /safety — view or change safety sensitivity (low/medium/high)' },
      { type: 'added', description: 'Command /debug — toggle debug mode for verbose logging' },
      { type: 'improved', description: 'Enhanced tool result display with JSON parsing and file listing' },
      { type: 'improved', description: 'Better error handling in health check system' },
    ]
  },
  {
    version: '1.2.0',
    date: '2026-05-20',
    changes: [
      { type: 'added', description: 'Command /config — view or edit configuration (max_tokens, temperature, etc.)' },
      { type: 'added', description: 'Command /apikey — view or change OpenRouter API key at runtime' },
      { type: 'added', description: 'Command /export — export conversation to JSON file' },
      { type: 'added', description: 'Command /reset — factory reset with optional --full flag' },
      { type: 'improved', description: 'Model switcher now supports direct model name input' },
    ]
  },
  {
    version: '1.1.0',
    date: '2026-05-19',
    changes: [
      { type: 'added', description: 'Full system health check before accepting user input' },
      { type: 'added', description: 'Memory system with persistent storage (.memory directory)' },
      { type: 'added', description: 'Safety system (PromptGuard) with configurable sensitivity' },
      { type: 'added', description: 'Command /memory — show memory summary' },
      { type: 'added', description: 'Command /history — show conversation history' },
      { type: 'added', description: 'Command /stats — show session statistics' },
      { type: 'added', description: 'Command /clear — clear conversation history' },
      { type: 'added', description: 'Command /health — re-run system health check' },
      { type: 'added', description: 'Command /model — view or switch active LLM model' },
    ]
  },
  {
    version: '1.0.0',
    date: '2026-05-19',
    changes: [
      { type: 'added', description: 'Initial release of NEX AI Terminal Coding Agent' },
      { type: 'added', description: 'OpenRouter API integration with multi-model support' },
      { type: 'added', description: 'File tools: create, read, update, delete' },
      { type: 'added', description: 'Shell command execution tool' },
      { type: 'added', description: 'Directory listing and file search tools' },
      { type: 'added', description: 'Memory tools: save, recall, learn, summary, clear' },
      { type: 'added', description: 'Colored terminal UI with chalk' },
      { type: 'added', description: 'Command /help with full command list' },
      { type: 'added', description: 'Command /exit and /quit to close session' },
    ]
  }
];

/**
 * Get the latest version string.
 */
export function getLatestVersion() {
  return changelog.length > 0 ? changelog[0].version : '0.0.0';
}

/**
 * Get the latest entry.
 */
export function getLatestEntry() {
  return changelog.length > 0 ? changelog[0] : null;
}

import { drawBoxHeader, drawBoxRow, drawBoxFooter, drawBoxSeparator, wrapText } from './ui.js';
import chalk from 'chalk';

/**
 * Format changelog entries for terminal display.
 * @param {number} limit — max entries to show (0 = all)
 */
export function formatChangelog(limit = 0) {
  const entries = limit > 0 ? changelog.slice(0, limit) : changelog;

  const typeColors = {
    added:      chalk.green,
    fixed:      chalk.yellow,
    improved:   chalk.cyan,
    changed:    chalk.blue,
    removed:    chalk.red,
    security:   chalk.magenta,
  };

  const typeIcons = {
    added:      '➕',
    fixed:      '🔧',
    improved:   '✨',
    changed:    '🔄',
    removed:    '🗑️',
    security:   '🔒',
  };

  const output = [];
  output.push('');
  output.push(drawBoxHeader('📋 CHANGELOG', chalk.blue, 78));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (i > 0) {
      output.push(drawBoxSeparator(chalk.blue, 78));
    }
    
    const versionHeader = `  Version ${entry.version}  —  ${entry.date}`;
    output.push(drawBoxRow(chalk.bold(versionHeader), chalk.blue, 78));
    output.push(drawBoxSeparator(chalk.blue, 78));

    for (const change of entry.changes) {
      const colorFn = typeColors[change.type] || chalk.white;
      const icon = typeIcons[change.type] || '•';
      const label = change.type.toUpperCase();
      const content = `  ${icon} ${colorFn('[' + label + ']')} ${change.description}`;
      
      const wrapped = wrapText(content, 74);
      wrapped.forEach(line => {
        output.push(drawBoxRow(line, chalk.blue, 78));
      });
    }
  }

  output.push(drawBoxFooter(chalk.blue, 78));
  output.push('');
  return output.join('\n');
}

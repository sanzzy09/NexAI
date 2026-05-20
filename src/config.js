// This Code Modified By NexAI
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.MODEL || 'baidu/cobuddy:free',
  // Model settings
  maxTokens: parseInt(process.env.MAX_TOKENS) || 4096,
  temperature: parseFloat(process.env.TEMPERATURE) || 0.3,
  // System context
  workingDirectory: process.cwd(),
  // Safety options
  safetySensitivity: process.env.SAFETY_SENSITIVITY || 'medium',
  canaryTokens: (process.env.CANARY_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean),
  // GitHub
  githubToken: process.env.GITHUB_TOKEN || '',
  // Default model (user preference, persists across sessions)
  defaultModel: process.env.DEFAULT_MODEL || '',
  // Dynamic UI theme
  theme: process.env.NEX_THEME || 'classic',
  // Telegram Integration
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAllowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '').split(',').map(u => u.trim()).filter(Boolean)
};

/**
 * Update a config value at runtime AND persist to .env file.
 * @param {string} key - The config key (must match .env variable name)
 * @param {string} value - The new value
 * @returns {boolean} true if saved successfully
 */
export function updateConfig(key, value) {
  const envMap = {
    OPENROUTER_API_KEY: 'openrouterApiKey',
    MODEL: 'model',
    MAX_TOKENS: 'maxTokens',
    TEMPERATURE: 'temperature',
    SAFETY_SENSITIVITY: 'safetySensitivity',
    CANARY_TOKENS: 'canaryTokens',
    GITHUB_TOKEN: 'githubToken',
    DEFAULT_MODEL: 'defaultModel',
    NEX_THEME: 'theme'
  };

  const configKey = envMap[key];
  if (!configKey) return false;

  // Update runtime config
  if (key === 'MAX_TOKENS') {
    config[configKey] = parseInt(value) || 4096;
  } else if (key === 'TEMPERATURE') {
    config[configKey] = parseFloat(value) || 0.3;
  } else if (key === 'CANARY_TOKENS') {
    config[configKey] = value.split(',').map(t => t.trim()).filter(Boolean);
  } else {
    config[configKey] = value;
  }

  // Persist to .env file
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let content = '';
    try {
      content = fs.readFileSync(envPath, 'utf8');
    } catch {
      // File doesn't exist, will create
    }

    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const envKeyUpper = key.toUpperCase();
    let found = false;

    const newLines = lines.map(line => {
      if (line.startsWith(envKeyUpper + '=')) {
        found = true;
        return `${envKeyUpper}=${value}`;
      }
      return line;
    });

    if (!found) {
      newLines.push(`${envKeyUpper}=${value}`);
    }

    fs.writeFileSync(envPath, newLines.join('\n') + '\n');
    return true;
  } catch (e) {
    console.error('[CONFIG] Failed to persist to .env:', e.message);
    return false;
  }
}

/**
 * Get a display-friendly config object (with masked API key)
 */
export function getConfigDisplay() {
  const key = config.openrouterApiKey || '';
  const masked = key.length > 16 ? key.substring(0, 12) + '••••••••••••' + key.slice(-4) : (key ? '••••' : '(not set)');

  const ghToken = config.githubToken || '';
  const ghMasked = ghToken.length > 8 ? ghToken.substring(0, 6) + '••••••••' + ghToken.slice(-4) : (ghToken ? '••••' : '(not set)');

  return {
    'API Key': masked,
    'Model': config.model,
    'Default Model': config.defaultModel || '(same as Model)',
    'Max Tokens': config.maxTokens,
    'Temperature': config.temperature,
    'Safety Sensitivity': config.safetySensitivity,
    'GitHub Token': ghMasked,
    'Working Directory': config.workingDirectory,
    'Theme': config.theme,
    'Canary Tokens': config.canaryTokens.length > 0 ? config.canaryTokens.length + ' set' : 'none'
  };
}

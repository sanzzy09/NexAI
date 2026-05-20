// This File Generate By NexAi
// This Code Modified By NexAI
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function executeMemoryTool(toolCall) {
  const { name, arguments: args } = toolCall.function;
  const argsObj = typeof args === 'string' ? JSON.parse(args) : args;

  switch (name) {
    case 'memory_save':
      return await memorySave(argsObj);
    case 'memory_recall':
      return await memoryRecall(argsObj);
    case 'memory_summary':
      return await memorySummary();
    case 'memory_clear':
      return await memoryClear();
    case 'memory_learn':
      return await memoryLearn(argsObj);
    default:
      return `Unknown memory tool: ${name}`;
  }
}

async function memorySave({ key, value }) {
  try {
    const memPath = path.join(__dirname, '..', '.memory', 'user_data.json');
    await fs.mkdir(path.dirname(memPath), { recursive: true });
    
    let userData = {};
    try {
      const existing = await fs.readFile(memPath, 'utf8');
      userData = JSON.parse(existing);
    } catch { /* ignore */ }
    
    userData[key] = {
      value,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(memPath, JSON.stringify(userData, null, 2));
    return `Memory saved: ${key} = ${value}`;
  } catch (e) {
    return `Error saving memory: ${e.message}`;
  }
}

async function memoryRecall({ query }) {
  try {
    const memDir = path.join(__dirname, '..', '.memory');
    try {
      await fs.access(memDir);
    } catch {
      return `No memories found for: ${query}`;
    }
    const files = await fs.readdir(memDir);
    const results = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(memDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Search in the data
        const dataStr = JSON.stringify(parsed).toLowerCase();
        if (dataStr.includes(query.toLowerCase()) || query.toLowerCase().includes(file.replace('.json', ''))) {
          results.push({ file, preview: JSON.stringify(parsed).substring(0, 500) });
        }
      }
    }

    if (results.length === 0) {
      return `No memories found for: ${query}`;
    }

    return `Found ${results.length} memory entries:\n${results.map(r => `- ${r.file}: ${r.preview}`).join('\n')}`;
  } catch (e) {
    return `Error recalling memory: ${e.message}`;
  }
}

async function memorySummary() {
  try {
    const memDir = path.join(__dirname, '..', '.memory');
    try {
      await fs.access(memDir);
    } catch {
      return `Memory Summary:\nNo memories saved yet.\n\nTotal memory files: 0`;
    }
    const files = await fs.readdir(memDir);
    const summary = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(memDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        const entries = Object.keys(parsed).length;
        summary.push(`- ${file}: ${entries} entries`);
      }
    }

    return `Memory Summary:\n${summary.join('\n')}\n\nTotal memory files: ${files.filter(f => f.endsWith('.json')).length}`;
  } catch (e) {
    return `Error getting summary: ${e.message}`;
  }
}

async function memoryClear() {
  try {
    const memDir = path.join(__dirname, '..', '.memory');
    try {
      await fs.access(memDir);
    } catch {
      return 'All memory cleared successfully (no memories existed).';
    }
    const files = await fs.readdir(memDir);
    
    for (const file of files) {
      await fs.unlink(path.join(memDir, file));
    }
    
    return 'All memory cleared successfully.';
  } catch (e) {
    return `Error clearing memory: ${e.message}`;
  }
}

async function memoryLearn({ insight }) {
  try {
    const memPath = path.join(__dirname, '..', '.memory', 'learned.json');
    await fs.mkdir(path.dirname(memPath), { recursive: true });
    
    let learned = [];
    try {
      const existing = await fs.readFile(memPath, 'utf8');
      learned = JSON.parse(existing);
    } catch { /* ignore */ }
    
    learned.push({
      insight,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100
    if (learned.length > 100) {
      learned = learned.slice(-100);
    }

    await fs.writeFile(memPath, JSON.stringify(learned, null, 2));
    return `Learned and saved: "${insight.substring(0, 100)}"`;
  } catch (e) {
    return `Error learning: ${e.message}`;
  }
}

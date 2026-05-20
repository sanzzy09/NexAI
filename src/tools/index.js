// This Code Modified By NexAI
import * as fileCreate from './file-create.js';
import * as fileRead from './file-read.js';
import * as fileUpdate from './file-update.js';
import * as fileDelete from './file-delete.js';
import * as runCommand from './run-command.js';
import * as listDirectory from './list-directory.js';
import * as searchFiles from './search-files.js';
import { executeMemoryTool } from './memory-tools.js';
import { ui } from '../ui.js';

export const toolsList = [
  fileCreate,
  fileRead,
  fileUpdate,
  fileDelete,
  runCommand,
  listDirectory,
  searchFiles
];

export const toolDefinitions = [
  ...toolsList.map(t => t.definition),
  {
    type: "function",
    function: {
      name: "memory_save",
      description: "Save a key-value pair to persistent memory",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key" },
          value: { type: "string", description: "Memory value" }
        },
        required: ["key", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "memory_recall",
      description: "Search through saved memories",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "memory_summary",
      description: "Get a summary of all saved memories",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "memory_clear",
      description: "Clear all persistent memory",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "memory_learn",
      description: "Save a learned insight or pattern",
      parameters: {
        type: "object",
        properties: {
          insight: { type: "string", description: "The insight or pattern to learn" }
        },
        required: ["insight"]
      }
    }
  }
];

export async function executeTool(toolCall) {
  const toolName = toolCall.function.name;
  let args = {};
  
  ui.printDebug(`[EXECUTE] Tool: ${toolName}`);
  
  try {
    if (toolCall.function.arguments) {
      args = JSON.parse(toolCall.function.arguments);
    }
    ui.printDebug(`[EXECUTE] Arguments: ${JSON.stringify(args, null, 2)}`);
  } catch (err) {
    ui.printDebug(`[EXECUTE] Error parsing arguments: ${err.message}`);
    return JSON.stringify({ success: false, error: "Invalid JSON arguments" });
  }

  // Check if it's a memory tool
  if (toolName.startsWith('memory_')) {
    return await executeMemoryTool(toolCall);
  }

  const tool = toolsList.find(t => t.definition.function.name === toolName);
  
  if (!tool) {
    ui.printDebug(`[EXECUTE] Unknown tool: ${toolName}`);
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }

  ui.printDebug(`[EXECUTE] Executing ${toolName}...`);
  const result = await tool.execute(args);
  ui.printDebug(`[EXECUTE] ${toolName} completed: ${result.substring(0, 200)}`);
  return result;
}

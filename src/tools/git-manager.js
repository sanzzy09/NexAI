import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export const definition = {
  type: "function",
  function: {
    name: "git_manager",
    description: "Manage Git repository tasks such as status, diff, and logging. Reports status of repository in the current working directory.",
    parameters: {
      type: "object",
      properties: {
        action: { 
          type: "string", 
          enum: ["status", "diff", "log"],
          description: "The git action to perform: status (porcelain overview), diff (uncommitted changes), or log (recent commit history)."
        },
        limit: { 
          type: "number", 
          description: "Limit the number of log items (only used with action: 'log'). Defaults to 10." 
        },
        cached: { 
          type: "boolean", 
          description: "Compare staged changes (git diff --cached) instead of unstaged. Only used with action: 'diff'." 
        }
      },
      required: ["action"]
    }
  }
};

// Helper to check if working directory is a git repository
async function isGitRepository() {
  try {
    const gitDir = path.resolve(process.cwd(), '.git');
    const stat = await fs.stat(gitDir);
    return stat.isDirectory();
  } catch {
    // Alternatively run git rev-parse --is-inside-work-tree
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: process.cwd() });
      return true;
    } catch {
      return false;
    }
  }
}

export async function execute(args) {
  const { action, limit = 10, cached = false } = args;
  console.log(`[GIT_MANAGER] Executing action: ${action}`);

  const isRepo = await isGitRepository();
  if (!isRepo) {
    console.log(`[GIT_MANAGER] Warning: Current working directory is not a git repository`);
    return JSON.stringify({ 
      success: false, 
      error: "The current working directory is not a git repository." 
    });
  }

  try {
    let command = '';
    if (action === 'status') {
      command = 'git status --porcelain';
    } else if (action === 'diff') {
      command = cached ? 'git diff --cached' : 'git diff';
    } else if (action === 'log') {
      const logLimit = Math.min(Math.max(1, limit), 100); // boundary check
      command = `git log -n ${logLimit} --oneline`;
    } else {
      return JSON.stringify({ success: false, error: `Unsupported git action: ${action}` });
    }

    console.log(`[GIT_MANAGER] Running command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
    
    return JSON.stringify({
      success: true,
      action,
      output: stdout.trim() || (action === 'diff' ? "No uncommitted differences found." : action === 'status' ? "Working tree clean." : "")
    });
  } catch (error) {
    console.log(`[GIT_MANAGER] Action failed: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: error.message,
      stdout: error.stdout ? error.stdout.toString().trim() : "",
      stderr: error.stderr ? error.stderr.toString().trim() : ""
    });
  }
}

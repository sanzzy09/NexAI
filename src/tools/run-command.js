import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const definition = {
  type: "function",
  function: {
    name: "run_command",
    description: "Execute a shell command on the host system. Use this to run scripts, install dependencies, compile code, etc. The command runs in the current working directory.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeoutMs: { type: "number", description: "Timeout in milliseconds (default 30000)" }
      },
      required: ["command"]
    }
  }
};

export async function execute(args) {
  console.log(`[RUN_CMD] Executing: ${args.command}`);
  console.log(`[RUN_CMD] Timeout: ${args.timeoutMs || 30000}ms`);
  console.log(`[RUN_CMD] Working directory: ${process.cwd()}`);
  try {
    const timeout = args.timeoutMs || 30000;
    const { stdout, stderr } = await execAsync(args.command, { 
      cwd: process.cwd(),
      timeout
    });
    console.log(`[RUN_CMD] Command succeeded`);
    console.log(`[RUN_CMD] stdout: ${stdout.substring(0, 200)}`);
    if (stderr) console.log(`[RUN_CMD] stderr: ${stderr.substring(0, 200)}`);
    
    return JSON.stringify({ 
      success: true, 
      stdout: stdout.trim(), 
      stderr: stderr.trim() 
    });
  } catch (error) {
    console.log(`[RUN_CMD] Command failed: ${error.message}`);
    console.log(`[RUN_CMD] stdout: ${error.stdout ? error.stdout.toString().trim() : 'none'}`);
    console.log(`[RUN_CMD] stderr: ${error.stderr ? error.stderr.toString().trim() : 'none'}`);
    return JSON.stringify({ 
      success: false, 
      error: error.message,
      stdout: error.stdout ? error.stdout.toString().trim() : "",
      stderr: error.stderr ? error.stderr.toString().trim() : ""
    });
  }
}

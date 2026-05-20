import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "list_directory",
    description: "List contents of a directory, providing metadata like file size and type.",
    parameters: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Absolute or relative path to the directory" }
      },
      required: ["dirPath"]
    }
  }
};

export async function execute(args) {
  console.log(`[LIST_DIR] Listing directory: ${args.dirPath || '.'}`);
  try {
    const fullPath = path.resolve(process.cwd(), args.dirPath || '.');
    console.log(`[LIST_DIR] Resolved path: ${fullPath}`);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    console.log(`[LIST_DIR] Found ${entries.length} entries`);
    
    const results = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(fullPath, entry.name);
      try {
        const stats = await fs.stat(entryPath);
        console.log(`[LIST_DIR]   - ${entry.name} (${entry.isDirectory() ? 'DIR' : stats.size + ' bytes'})`);
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          sizeBytes: stats.size,
          modified: stats.mtime.toISOString()
        };
      } catch (err) {
        console.log(`[LIST_DIR]   - ${entry.name} (error reading stats)`);
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          error: "Could not read stats"
        };
      }
    }));
    
    console.log(`[LIST_DIR] Directory listing completed`);
    return JSON.stringify({ success: true, path: fullPath, contents: results });
  } catch (error) {
    console.log(`[LIST_DIR] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "file_delete",
    description: "Delete a file or an empty directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path to delete" },
        recursive: { type: "boolean", description: "If true, recursively deletes directory and its contents" }
      },
      required: ["path"]
    }
  }
};

export async function execute(args) {
  console.log(`[FILE_DELETE] Deleting: ${args.path} (recursive: ${args.recursive || false})`);
  try {
    const fullPath = path.resolve(process.cwd(), args.path);
    console.log(`[FILE_DELETE] Resolved path: ${fullPath}`);
    const recursive = args.recursive || false;
    
    await fs.rm(fullPath, { recursive, force: true });
    console.log(`[FILE_DELETE] Successfully deleted: ${fullPath}`);
    
    return JSON.stringify({ success: true, message: `Successfully deleted ${fullPath}` });
  } catch (error) {
    console.log(`[FILE_DELETE] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "file_read",
    description: "Read the contents of a file.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative path to the file to read" }
      },
      required: ["filePath"]
    }
  }
};

export async function execute(args) {
  console.log(`[FILE_READ] Reading file: ${args.filePath}`);
  try {
    const fullPath = path.resolve(process.cwd(), args.filePath);
    console.log(`[FILE_READ] Resolved path: ${fullPath}`);
    const content = await fs.readFile(fullPath, 'utf8');
    console.log(`[FILE_READ] File read successfully, size: ${content.length} bytes`);
    return JSON.stringify({ success: true, content });
  } catch (error) {
    console.log(`[FILE_READ] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

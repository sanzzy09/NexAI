import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "file_create",
    description: "Create a new file with the specified content. Also creates parent directories if they don't exist.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative path to the file to create" },
        content: { type: "string", description: "Content of the file" }
      },
      required: ["filePath", "content"]
    }
  }
};

export async function execute(args) {
  console.log(`[FILE_CREATE] Creating file: ${args.filePath}`);
  try {
    const fullPath = path.resolve(process.cwd(), args.filePath);
    console.log(`[FILE_CREATE] Resolved path: ${fullPath}`);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    console.log(`[FILE_CREATE] Parent directories ensured`);
    
    try {
      await fs.access(fullPath);
      console.log(`[FILE_CREATE] File already exists: ${fullPath}`);
      return JSON.stringify({ success: false, error: "File already exists. Use file_update to modify it." });
    } catch {
      console.log(`[FILE_CREATE] File does not exist, proceeding to create`);
    }

    await fs.writeFile(fullPath, args.content, 'utf8');
    console.log(`[FILE_CREATE] File created successfully: ${fullPath}`);
    return JSON.stringify({ success: true, message: `File created successfully at ${fullPath}` });
  } catch (error) {
    console.log(`[FILE_CREATE] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

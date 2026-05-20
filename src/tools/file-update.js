import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "file_update",
    description: "Update an existing file by replacing its entire content or appending to it.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative path to the file" },
        content: { type: "string", description: "The new content" },
        mode: { type: "string", enum: ["replace", "append"], description: "Whether to replace the file or append to it" }
      },
      required: ["filePath", "content", "mode"]
    }
  }
};

export async function execute(args) {
  console.log(`[FILE_UPDATE] Updating file: ${args.filePath} (mode: ${args.mode})`);
  try {
    const fullPath = path.resolve(process.cwd(), args.filePath);
    console.log(`[FILE_UPDATE] Resolved path: ${fullPath}`);
    
    // Ensure file exists
    await fs.access(fullPath);
    console.log(`[FILE_UPDATE] File exists, proceeding`);

    if (args.mode === "append") {
      await fs.appendFile(fullPath, args.content, 'utf8');
      console.log(`[FILE_UPDATE] Appended ${args.content.length} bytes to file`);
    } else {
      await fs.writeFile(fullPath, args.content, 'utf8');
      console.log(`[FILE_UPDATE] Replaced file content`);
    }
    
    return JSON.stringify({ success: true, message: `File updated successfully in ${args.mode} mode.` });
  } catch (error) {
    console.log(`[FILE_UPDATE] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

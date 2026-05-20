import fs from 'fs/promises';
import path from 'path';

export const definition = {
  type: "function",
  function: {
    name: "search_files",
    description: "Search for a text pattern in files within a directory.",
    parameters: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "Directory to search in" },
        query: { type: "string", description: "The text to search for" },
        fileExtension: { type: "string", description: "Optional file extension to filter by (e.g. '.js')" }
      },
      required: ["dirPath", "query"]
    }
  }
};

async function searchInDir(dir, query, extFilter, results) {
  console.log(`[SEARCH] Searching in: ${dir}`);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  console.log(`[SEARCH] Found ${entries.length} entries in ${dir}`);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
        await searchInDir(fullPath, query, extFilter, results);
      } else {
        console.log(`[SEARCH] Skipping directory: ${entry.name}`);
      }
    } else {
      if (extFilter && !entry.name.endsWith(extFilter)) {
        console.log(`[SEARCH] Skipping ${entry.name} (extension mismatch)`);
        continue;
      }
      
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        if (content.includes(query)) {
          console.log(`[SEARCH] Match found: ${fullPath}`);
          results.push(fullPath);
        }
      } catch (err) {
        console.log(`[SEARCH] Could not read: ${fullPath}`);
      }
    }
  }
}

export async function execute(args) {
  console.log(`[SEARCH] Starting search for: "${args.query}" in ${args.dirPath || '.'}`);
  if (args.fileExtension) console.log(`[SEARCH] Filter by extension: ${args.fileExtension}`);
  try {
    const fullPath = path.resolve(process.cwd(), args.dirPath || '.');
    console.log(`[SEARCH] Resolved path: ${fullPath}`);
    const results = [];
    
    await searchInDir(fullPath, args.query, args.fileExtension, results);
    
    // Map absolute paths to relative
    const relativeResults = results.map(p => path.relative(process.cwd(), p));
    
    console.log(`[SEARCH] Search completed. ${relativeResults.length} matches found`);
    return JSON.stringify({ 
      success: true, 
      query: args.query,
      matchCount: relativeResults.length,
      matches: relativeResults.slice(0, 50)
    });
  } catch (error) {
    console.log(`[SEARCH] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
}

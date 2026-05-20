import { z } from "zod";
import { toolsList } from "../tools/index.js";

// Helper to convert JSON Schema from OpenRouter tools to Zod for MCP SDK
function jsonSchemaToZod(schema) {
  if (!schema || !schema.properties) return z.object({});
  
  const shape = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType;
    switch (prop.type) {
      case 'string':
        zodType = z.string();
        if (prop.enum) zodType = z.enum(prop.enum);
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      default:
        zodType = z.any();
    }
    
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }
    
    if (!schema.required || !schema.required.includes(key)) {
      zodType = zodType.optional();
    }
    
    shape[key] = zodType;
  }
  
  return z.object(shape);
}

export function registerToolsToMcpServer(mcpServer) {
  console.error('[MCP_ADAPTER] Registering tools to MCP server...');
  for (const tool of toolsList) {
    const name = tool.definition.function.name;
    const description = tool.definition.function.description;
    const inputSchema = jsonSchemaToZod(tool.definition.function.parameters);
    
    console.error(`[MCP_ADAPTER] Registering tool: ${name}`);
    
    mcpServer.registerTool(
      name,
      { description, inputSchema },
      async (args) => {
        try {
          console.error(`[MCP_ADAPTER] Executing tool: ${name} with args: ${JSON.stringify(args)}`);
          const resultStr = await tool.execute(args);
          console.error(`[MCP_ADAPTER] Tool ${name} completed: ${resultStr.substring(0, 200)}`);
          return {
            content: [{ type: "text", text: resultStr }]
          };
        } catch (error) {
          console.error(`[MCP_ADAPTER] Tool ${name} error: ${error.message}`);
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true
          };
        }
      }
    );
  }
  console.error('[MCP_ADAPTER] All tools registered');
}

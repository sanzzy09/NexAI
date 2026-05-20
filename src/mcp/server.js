import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerToolsToMcpServer } from "./tools-adapter.js";

console.error('[MCP] Starting NEX AI MCP Server...');

async function main() {
  const server = new McpServer({
    name: "nex-ai-mcp",
    version: "1.0.0",
  });

  console.error('[MCP] Registering tools...');
  registerToolsToMcpServer(server);
  console.error('[MCP] Tools registered');

  const transport = new StdioServerTransport();
  console.error('[MCP] Connecting transport...');
  await server.connect(transport);
  console.error('[MCP] MCP Server connected');
  
  // Note: when running as MCP server via stdio, we don't log to stdout normally 
  // because stdout is used for the MCP protocol. Console.error can be used for debugging.
}

main().catch(error => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});

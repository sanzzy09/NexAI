import fs from 'fs/promises';
import path from 'path';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ui } from "../ui.js";

export class McpClientManager {
  constructor() {
    this.servers = new Map(); // name -> { client, transport, command, args, tools }
    this.configPath = path.resolve(process.cwd(), '.memory', 'mcp_servers.json');
  }

  /**
   * Initialize dynamic MCP connections. Loads previously configured
   * servers from .memory/mcp_servers.json and attempts to reconnect.
   */
  async initialize() {
    ui.printInfo("Initializing Dynamic MCP Client Bridge...");
    try {
      // Ensure .memory folder exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      let data;
      try {
        data = await fs.readFile(this.configPath, 'utf8');
      } catch {
        // No saved configurations yet
        ui.printInfo("No previous MCP server configurations found.");
        return;
      }

      const config = JSON.parse(data);
      if (!config || !config.servers || !Array.isArray(config.servers)) {
        return;
      }

      for (const server of config.servers) {
        ui.printInfo(`Reconnecting to external MCP server: ${server.name}...`);
        try {
          await this.connectServer(server.name, server.command, server.args, false);
          ui.printSuccess(`Successfully reconnected to ${server.name}`);
        } catch (error) {
          ui.printError(`Failed to reconnect to ${server.name}: ${error.message}`);
        }
      }
    } catch (err) {
      ui.printError(`MCP Client initialization failed: ${err.message}`);
    }
  }

  /**
   * Connects to a new external stdio MCP server at runtime.
   * If saveConfig is true, persists to disk.
   */
  async connectServer(name, command, args = [], saveConfig = true) {
    if (this.servers.has(name)) {
      throw new Error(`MCP Server with name '${name}' is already connected.`);
    }

    ui.printDebug(`[MCP_CLIENT] Spawning subprocess: ${command} ${args.join(' ')}`);

    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env }
    });

    const client = new Client({
      name: "nex-ai-bridge-client",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    try {
      // Wait for transport and client connection
      await client.connect(transport);

      // List all tools from remote server
      const response = await client.listTools();
      const tools = response.tools || [];

      ui.printDebug(`[MCP_CLIENT] Connected to ${name}. Discovered ${tools.length} tools.`);

      this.servers.set(name, {
        client,
        transport,
        command,
        args,
        tools
      });

      if (saveConfig) {
        await this.saveConfig();
      }

      return tools;
    } catch (error) {
      // Clean up transport on failure
      try {
        await transport.close();
      } catch {}
      throw error;
    }
  }

  /**
   * Disconnects and stops the subprocess of an external MCP server.
   */
  async disconnectServer(name) {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`No connected MCP server found with name '${name}'.`);
    }

    ui.printInfo(`Disconnecting external MCP server: ${name}...`);
    try {
      await server.client.close();
    } catch (e) {
      ui.printDebug(`[MCP_CLIENT] Client close error: ${e.message}`);
    }

    try {
      await server.transport.close();
    } catch (e) {
      ui.printDebug(`[MCP_CLIENT] Transport close error: ${e.message}`);
    }

    this.servers.delete(name);
    await this.saveConfig();
    ui.printSuccess(`Successfully disconnected ${name}`);
  }

  /**
   * Save connected servers to .memory/mcp_servers.json.
   */
  async saveConfig() {
    try {
      const serverList = [];
      for (const [name, data] of this.servers.entries()) {
        serverList.push({
          name,
          command: data.command,
          args: data.args
        });
      }
      await fs.writeFile(this.configPath, JSON.stringify({ servers: serverList }, null, 2));
      ui.printDebug(`[MCP_CLIENT] Persisted connected servers list to config.`);
    } catch (error) {
      ui.printError(`Failed to save MCP server list to config: ${error.message}`);
    }
  }

  /**
   * Gets list of dynamic tools formatted for OpenRouter schema with name prefix.
   */
  getOpenRouterTools() {
    const prefixedTools = [];

    for (const [serverName, serverData] of this.servers.entries()) {
      for (const tool of serverData.tools) {
        prefixedTools.push({
          type: "function",
          function: {
            name: `${serverName}__${tool.name}`,
            description: `[MCP: ${serverName}] ${tool.description}`,
            parameters: tool.inputSchema
          }
        });
      }
    }

    return prefixedTools;
  }

  /**
   * Executes a tool dynamically on the corresponding remote server.
   */
  async executeDynamicTool(prefixedName, args) {
    const separatorIndex = prefixedName.indexOf('__');
    if (separatorIndex === -1) {
      throw new Error(`Invalid prefixed tool name: ${prefixedName}`);
    }

    const serverName = prefixedName.substring(0, separatorIndex);
    const originalToolName = prefixedName.substring(separatorIndex + 2);

    const serverData = this.servers.get(serverName);
    if (!serverData) {
      throw new Error(`MCP server '${serverName}' is not currently connected.`);
    }

    ui.printInfo(`Executing external tool: ${originalToolName} on server ${serverName}...`);
    try {
      const response = await serverData.client.callTool({
        name: originalToolName,
        arguments: args
      });

      if (response && response.content) {
        // Collect text content outputs
        const textOutput = response.content
          .filter(c => c.type === "text")
          .map(c => c.text)
          .join('\n');
        
        return textOutput || JSON.stringify(response);
      }

      return JSON.stringify(response);
    } catch (error) {
      ui.printError(`Error running remote tool ${originalToolName} on ${serverName}: ${error.message}`);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Returns list of connected servers with status information.
   */
  getServersStatus() {
    const status = [];
    for (const [name, data] of this.servers.entries()) {
      status.push({
        name,
        command: data.command,
        args: data.args.join(' '),
        toolsCount: data.tools.length
      });
    }
    return status;
  }
}

# NEX AI — Terminal AI Agent with MCP Tools

NEX AI is a terminal-based AI coding assistant powered by OpenRouter API with MCP (Model Context Protocol) tool-use capabilities. It runs directly in your terminal and helps you with coding tasks by creating files, executing commands, searching code, and managing persistent memory.

## Features

- **Interactive REPL** — Chat with the AI assistant directly in your terminal
- **MCP Server** — Expose NEX AI's tools for external agents (Cursor, Claude Desktop, etc.)
- **Persistent Memory** — Save and recall information across sessions
- **Safety Guard** — Prompt injection detection and content filtering
- **Rich UI** — Colored output, spinners, and box-drawing for better readability
- **Transparent Logging** — All operations logged with prefix tags for debugging

## Project Structure

```
nex-ai/
├── src/
│   ├── index.js          # Main entry point (REPL)
│   ├── agent.js          # AI agent logic and tool orchestration
│   ├── config.js         # Configuration and environment loading
│   ├── ui.js             # Terminal UI rendering (colors, boxes, spinners)
│   ├── memory.js         # Persistent memory management
│   ├── changelog.js      # Session changelog tracking
│   ├── health-check.js   # System health diagnostics
│   ├── tools/            # Built-in tool implementations
│   │   ├── file-create.js
│   │   ├── file-read.js
│   │   ├── file-update.js
│   │   ├── file-delete.js
│   │   ├── list-directory.js
│   │   ├── search-files.js
│   │   ├── run-command.js
│   │   ├── memory-tools.js
│   │   └── index.js      # Tool registry
│   ├── safety/           # Safety and content filtering
│   │   └── prompt-guard.js
│   └── mcp/              # MCP server for external integrations
│       ├── server.js
│       └── tools-adapter.js
├── .env                  # Environment variables (API keys, model config)
├── package.json
└── SKILL.md              # Skill documentation
```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/sanzzy09/NexAI.git
   cd NexAI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file with your configuration:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key
   MODEL=baidu/cobuddy:free
   SAFETY_SENSITIVITY=medium
   DEFAULT_MODEL=openrouter/owl-alpha
   ```

## Usage

### Interactive Terminal (REPL)
Start the AI assistant in your terminal:
```bash
npm start
```

Special commands inside the REPL:
| Command   | Description                  |
|-----------|------------------------------|
| `/help`   | Show help information        |
| `/clear`  | Clear conversation history   |
| `/exit`   | Quit the assistant           |

### MCP Server
Expose NEX AI's tools as an MCP server for other agents:
```bash
npm run mcp
```

## Available Tools

NEX AI comes with **12 built-in tools**:

| Tool              | Category  | Description                          |
|-------------------|-----------|--------------------------------------|
| `file_create`     | Files     | Create a new file with content       |
| `file_read`       | Files     | Read file contents                   |
| `file_update`     | Files     | Update or append to a file           |
| `file_delete`     | Files     | Delete files or directories          |
| `list_directory`  | Files     | List directory contents              |
| `search_files`    | Files     | Search for patterns in files         |
| `run_command`     | Execute   | Run shell commands                   |
| `memory_save`     | Memory    | Save key-value pairs to memory       |
| `memory_recall`   | Memory    | Search through saved memories        |
| `memory_summary`  | Memory    | Get overview of all memories         |
| `memory_clear`    | Memory    | Clear all persistent memory          |
| `memory_learn`    | Memory    | Save learned insights and patterns   |

## Logging

All operations are logged with transparent prefix tags:

| Tag             | Description                    |
|-----------------|--------------------------------|
| `[SESSION]`     | Session lifecycle events       |
| `[API]`         | API requests/responses         |
| `[EXECUTE]`     | Tool execution                 |
| `[FILE_*]`      | File operations                |
| `[RUN_CMD]`     | Command execution              |
| `[SEARCH]`      | File search operations         |
| `[MCP]`         | MCP server logs                |
| `[DEBUG]`       | Debug-level messages           |
| `[INFO]`        | Informational messages         |
| `[WARN]`        | Warning messages               |
| `[ERROR]`       | Error messages                 |

## Dependencies

| Package                          | Purpose                        |
|----------------------------------|--------------------------------|
| `@modelcontextprotocol/sdk`      | MCP protocol support           |
| `chalk`                          | Terminal colors and styling    |
| `dotenv`                         | Environment variable loading   |
| `ora`                            | Terminal spinners              |
| `zod`                            | Schema validation              |

## License

MIT

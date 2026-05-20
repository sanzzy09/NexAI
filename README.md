# NEX AI — Terminal AI Agent with MCP Tools

NEX AI is a terminal-based AI coding assistant powered by OpenRouter API (`baidu/cobuddy:free`) with MCP tool-use capabilities. It runs directly in your terminal and helps you with coding tasks by creating files, executing commands, and more.

## Setup

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your OpenRouter API key:
   ```bash
   OPENROUTER_API_KEY=your_key_here
   ```

## Usage

### Interactive Terminal (REPL)
To start the AI assistant in your terminal:
```bash
npm start
```
Special commands inside the REPL:
- `/help` - Show help
- `/clear` - Clear conversation history
- `/exit` - Quit the assistant

### MCP Server
To expose NEX AI's tools as an MCP server for other agents (like Cursor, Claude Desktop):
```bash
npm run mcp
```

## Features

NEX AI comes with 7 built-in tools:
- **Create**: `file_create`
- **Read**: `file_read`, `list_directory`, `search_files`
- **Update**: `file_update`
- **Delete**: `file_delete`
- **Execute**: `run_command`

All operations are logged with transparent logging for debugging and monitoring.

## Logging

All files now include transparent logging with prefix tags:
- `[SESSION]` - Session lifecycle events
- `[API]` - API requests/responses
- `[EXECUTE]` - Tool execution
- `[FILE_*]` - File operations
- `[RUN_CMD]` - Command execution
- `[SEARCH]` - File search operations
- `[MCP]` / `[MCP_ADAPTER]` - MCP server logs
- `[DEBUG]` / `[INFO]` / `[WARN]` / `[ERROR]` - Log levels

Enjoy your new AI coding assistant!

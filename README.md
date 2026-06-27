# @anthelis/puter-claude-mcp

> **Free, unlimited Claude access for any AI coding agent or IDE — powered by [Puter.js](https://puter.com).**

This is an MCP (Model Context Protocol) server that gives AI coding assistants like [Antigravity](https://antigravity.dev), Cursor, Windsurf, and others access to **Claude Sonnet 4.6** and **Claude Fable 5** completely for free — no API keys, no billing, no limits.

It uses **Puter.js** (the "User-Pays" model) via a local browser bridge, so the requests run through your own logged-in Puter account in a browser tab.

> **Legal note:** Each user must log into their own [Puter.com](https://puter.com) account in the browser bridge. This project does not circumvent any API limits — it simply makes Puter's official free developer offering accessible via MCP. This project is not affiliated with, endorsed by, or sponsored by Puter or Anthropic. All Claude AI capabilities are provided by [Puter.js](https://github.com/HeyPuter/puter) under their [Terms of Service](https://puter.com/terms).

---

## How It Works

```
Your IDE ──(MCP/stdio)──► index.js ──(HTTP)──► relay.js ◄──(polls)── browser tab
                                                              │
                                                         puter.ai.chat()
                                                              │
                                                           Claude API (free!)
```

- **`relay.js`** — A small Express server you run once. It holds requests from the MCP server and delivers them to the browser.
- **`index.js`** — The MCP server your IDE launches. It exposes the `ask_claude` tool and talks to the relay via HTTP.
- **Browser tab** — You open `http://localhost:8081` in your browser. It polls the relay every second, sends requests to Claude via Puter.js, and posts the results back.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free [Puter.com](https://puter.com) account (sign up is free)
- An IDE that supports MCP (Antigravity, Cursor, Windsurf, VS Code with MCP extension, etc.)

---

## Installation

### Option A: npx (Recommended — no install needed)
```bash
# Run the relay server directly
npx @anthelis/puter-claude-mcp relay
```
That's it! No cloning, no `npm install`.

### Option B: Install globally
```bash
npm install -g @anthelis/puter-claude-mcp

# Then run the relay:
puter-claude-relay
```

### Option C: Clone from source
```bash
git clone https://github.com/ANTHELIS/@anthelis/puter-claude-mcp.git
cd @anthelis/puter-claude-mcp
npm install
npm run relay
```

---

## Setup

### Step 1: Start the Relay Server
Open a terminal in the project folder and run:
```bash
npm run relay
```
Keep this terminal open. You should see:
```
✅ Puter-Claude Relay Server running at http://localhost:8081
```

### Step 2: Open the Browser Bridge
Open **http://localhost:8081** in your web browser (Chrome, Edge, Firefox — any works).

You will be prompted to log in to Puter if you haven't already. Once logged in, the page will show:
```
✅ Connected — Waiting for IDE requests...
```
**Keep this tab open** while you code.

### Step 3: Configure Your IDE
Add the following to your IDE's MCP configuration file:

```json
{
  "mcpServers": {
    "puter-claude": {
      "command": "npx",
      "args": ["-y", "@anthelis/puter-claude-mcp"]
    }
  }
}
```

> If you cloned from source, use `"command": "node"` and `"args": ["/absolute/path/to/@anthelis/puter-claude-mcp/index.js"]` instead.

| IDE | Config file location |
|---|---|
| Antigravity IDE | `C:\Users\<you>\.gemini\config\mcp_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code (MCP ext) | `.vscode/mcp.json` in workspace |

### Step 4: Reload Your IDE
Reload the IDE window so it picks up the new MCP server. You're ready!

---

## Usage

Once everything is set up, just ask your AI coding agent to **"ask Claude"** to do something:

- *"Ask Claude to write a Python script that reads a CSV and outputs a chart"*
- *"Ask Claude to review my `index.js` for bugs"*
- *"Ask Claude to generate unit tests for this function"*

The agent will call the `ask_claude` MCP tool, the browser tab will handle it silently, and Claude's response comes back in seconds.

### Available Models

| Model | Puter.js name |
|---|---|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Fable 5 | `claude-fable-5` |

---

## Configuration

You can configure the relay port via an environment variable:

```bash
PUTER_RELAY_PORT=9090 npm run relay
```

And set the relay URL for the MCP server:
```json
{
  "mcpServers": {
    "puter-claude": {
      "command": "node",
      "args": ["/path/to/index.js"],
      "env": {
        "PUTER_RELAY_URL": "http://localhost:9090"
      }
    }
  }
}
```

---

## Stopping the Server

To stop the relay server, simply press `Ctrl+C` in the terminal running `npm run relay`.

---

## Architecture Details

- The relay uses a **request queue** — only one Claude request is processed at a time.
- The browser bridge **polls every second** for new work, keeping the connection alive.
- The MCP server waits up to **120 seconds** for a response before timing out.
- All communication is **localhost-only** — nothing leaves your machine except the Puter.js API call from your browser.

---

## Contributing

PRs are welcome! Some ideas for improvements:
- [ ] Support for concurrent requests (queue-based)
- [ ] Support for streaming responses
- [ ] A richer bridge UI with request history
- [ ] Support for additional Puter.js models (GPT-4o, Gemini, etc.)

---

## License

MIT — do whatever you want with it.

---

## Credits

- Built with [Puter.js](https://puter.com) — the "User-Pays" AI platform
- Uses the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) by Anthropic
- Inspired by the [Puter.js Free Claude API tutorial](https://docs.puter.com/tutorials/free-unlimited-claude-api/)

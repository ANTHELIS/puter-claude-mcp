#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// MCP uses stdout for protocol messages; use stderr for all logging
const RELAY_URL = process.env.PUTER_RELAY_URL ?? 'http://localhost:8081';
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_PROMPT_LENGTH = 100_000;
const VALID_MODELS = new Set(["claude-sonnet-4-6", "claude-fable-5"]);

/**
 * @param {string} prompt
 * @param {string} model
 * @returns {Promise<{isError?: boolean, content: Array<{type: string, text: string}>}>}
 */
async function askClaudeViaRelay(prompt, model) {
    // 1. Check if the relay server is running and the browser bridge is connected
    let statusRes;
    try {
        statusRes = await fetch(`${RELAY_URL}/api/bridge-status`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
    } catch {
        return { isError: true, content: [{ type: "text", text: `Error: Relay server is not running. Please start it with: npm run relay (in the puter-claude-mcp directory)` }] };
    }

    let statusBody;
    try {
        statusBody = await statusRes.json();
    } catch {
        return { isError: true, content: [{ type: "text", text: "Error: Relay returned an unexpected response." }] };
    }

    if (!statusBody.connected) {
        return { isError: true, content: [{ type: "text", text: "Error: Browser bridge not connected. Open http://localhost:8081 in your browser and keep the tab open." }] };
    }

    // 2. Submit the request to the relay
    let reqRes;
    try {
        reqRes = await fetch(`${RELAY_URL}/api/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
    } catch {
        return { isError: true, content: [{ type: "text", text: "Error: Failed to submit request to relay. Is it still running?" }] };
    }

    if (!reqRes.ok) {
        let errBody;
        try { errBody = await reqRes.json(); } catch { errBody = { error: `HTTP ${reqRes.status}` }; }
        return { isError: true, content: [{ type: "text", text: `Error: ${errBody.error}` }] };
    }

    let reqBody;
    try {
        reqBody = await reqRes.json();
    } catch {
        return { isError: true, content: [{ type: "text", text: "Error: Relay returned an invalid request ID." }] };
    }

    const { id } = reqBody;
    if (typeof id !== 'number') {
        return { isError: true, content: [{ type: "text", text: "Error: Relay returned an invalid request ID." }] };
    }

    // 3. Poll for the result (up to POLL_TIMEOUT_MS)
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        try {
            const pollRes = await fetch(`${RELAY_URL}/api/result/${id}`, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
            });
            if (!pollRes.ok) continue; // Relay error — retry
            const data = await pollRes.json();
            if (data.ready) {
                const { success, text, error } = data.result;
                if (success) {
                    return { content: [{ type: "text", text }] };
                } else {
                    return { isError: true, content: [{ type: "text", text: `Puter.js Error: ${error}` }] };
                }
            }
        } catch {
            // Network hiccup during poll — retry rather than crash
            continue;
        }
    }

    return { isError: true, content: [{ type: "text", text: `Error: Request timed out after ${POLL_TIMEOUT_MS / 1000} seconds.` }] };
}

// --- MCP Server ---
const server = new Server(
    { name: "@anthelis/puter-claude-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
        name: "ask_claude",
        description: "Ask Claude (via Puter.js) to write code, answer questions, or solve problems — for free, with no API key. Requires the relay server (relay.js) to be running and the browser bridge tab (http://localhost:8081) to be open.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "The full prompt to send to Claude." },
                model: {
                    type: "string",
                    enum: ["claude-sonnet-4-6", "claude-fable-5"],
                    default: "claude-sonnet-4-6",
                    description: "Which Claude model to use."
                }
            },
            required: ["prompt"]
        }
    }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (request.params.name !== "ask_claude") {
            throw new Error(`Unknown tool: ${request.params.name}`);
        }

        // Validate prompt
        const prompt = request.params.arguments?.prompt;
        if (typeof prompt !== 'string' || prompt.trim() === '') {
            return { isError: true, content: [{ type: "text", text: "Error: 'prompt' must be a non-empty string." }] };
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return { isError: true, content: [{ type: "text", text: `Error: Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.` }] };
        }

        // Validate model
        const model = request.params.arguments?.model ?? "claude-sonnet-4-6";
        if (!VALID_MODELS.has(model)) {
            return { isError: true, content: [{ type: "text", text: `Error: Invalid model '${model}'. Valid options: ${[...VALID_MODELS].join(', ')}` }] };
        }

        return await askClaudeViaRelay(prompt, model);
    } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Internal error: ${err.message}` }] };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // MCP uses stdout for protocol; stderr is safe for logging
    console.error(`Puter-Claude MCP server v2 running. Relay: ${RELAY_URL}`);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});

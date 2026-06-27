#!/usr/bin/env node
/**
 * relay.js — Run this ONCE manually: node relay.js
 * Keep it running. The browser and the MCP server both talk to this.
 */
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Shared state
let pendingRequest = null;
let pendingResponse = null;
let requestIdCounter = 0;
let bridgeLastSeen = 0;

// --- Endpoints used by the BROWSER ---

// Browser polls this to check for pending work
app.get('/api/poll', (req, res) => {
    bridgeLastSeen = Date.now();
    if (pendingRequest) {
        res.json({ hasRequest: true, request: pendingRequest });
    } else {
        res.json({ hasRequest: false });
    }
});

// Browser submits the result from Claude back here
app.post('/api/submit', (req, res) => {
    const { id, success, text, error } = req.body;
    if (pendingRequest && pendingRequest.id === id) {
        pendingResponse = { id, success, text, error };
    }
    res.json({ ok: true });
});

// --- Endpoints used by the MCP SERVER ---

// MCP server checks if browser is alive
app.get('/api/bridge-status', (req, res) => {
    const connected = (Date.now() - bridgeLastSeen) < 5000;
    res.json({ connected, lastSeen: bridgeLastSeen });
});

// MCP server POSTs a new request here
app.post('/api/request', (req, res) => {
    if (pendingRequest) {
        return res.status(409).json({ error: 'Another request already in progress.' });
    }
    const { prompt, model } = req.body;
    const id = ++requestIdCounter;
    pendingRequest = { id, prompt, model };
    pendingResponse = null;
    res.json({ id });
});

// MCP server polls here waiting for the result
app.get('/api/result/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (pendingResponse && pendingResponse.id === id) {
        const result = pendingResponse;
        pendingRequest = null;
        pendingResponse = null;
        res.json({ ready: true, result });
    } else {
        res.json({ ready: false });
    }
});

// Serve the bridge UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`✅ Puter-Claude Relay Server running at http://localhost:${PORT}`);
    console.log(`   Open http://localhost:${PORT} in your browser to connect the bridge.`);
});

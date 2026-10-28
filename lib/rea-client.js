'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// Use the application's pinned package, not a machine-specific npm cache path.
function launcher() {
  const file = path.join(__dirname, '..', 'node_modules', 'rea-agents', 'scripts', 'rea.mjs');
  if (!fs.existsSync(file)) throw new Error('REA is not installed. Run npm install in the app directory.');
  return file;
}

function decodeResult(response) {
  if (response.isError) throw new Error((response.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').slice(0, 1500));
  if (response.structuredContent) return response.structuredContent;
  for (const c of response.content || []) {
    if (c.type === 'text') { try { return JSON.parse(c.text); } catch {} }
  }
  throw new Error('REA returned no structured evidence.');
}

async function withRea(callback) {
  const client = new Client({ name: 'oliveboard-live-capture', version: '2.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcher(), 'mcp'], stderr: 'pipe' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = new Set(tools.tools.map(t => t.name));
    const call = async (name, args) => {
      if (!names.has(name)) throw new Error(`Installed REA does not advertise ${name}.`);
      return decodeResult(await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 }));
    };
    return await callback({ call, tools: tools.tools, server: client.getServerVersion() });
  } finally { await client.close().catch(() => {}); }
}

module.exports = { withRea, decodeResult };

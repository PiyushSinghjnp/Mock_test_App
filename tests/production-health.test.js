'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('production liveness serves built assets, does not wake Neon, and leaves MCP disabled', async t => {
  const previous = Object.fromEntries(['NODE_ENV','DATABASE_URL','SESSION_SECRET','OLIVEBOARD_ADMIN_TOKEN'].map(key => [key, process.env[key]]));
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://user:placeholder@invalid-pooler.example/db';
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.OLIVEBOARD_ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
  const { createApp } = require('../server-postgres');
  const { closePool } = require('../db/postgres');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await closePool();
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/health', '/', '/admin']) assert.equal((await fetch(base + path)).status, 200, path);
  for (const [path, expected] of [
    ['/js/test-engine.js?v=test', /class OliveboardTestEngine/],
    ['/js/solution-engine.js?v=test', /obSolutionEngine|SolutionEngine/]
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), expected, `${path} must serve its lazy-loaded script`);
  }
  for (const path of ['/api/mcp/manifest', '/mcp']) assert.equal((await fetch(base + path)).status, 404, path);
  for (const path of ['/.env', '/database.sqlite']) {
    const response = await fetch(base + path);
    assert.equal(response.headers.get('content-type')?.split(';')[0], 'text/html', path);
    assert.match(await response.text(), /<html/i, `${path} must not be served as a private file`);
  }
});

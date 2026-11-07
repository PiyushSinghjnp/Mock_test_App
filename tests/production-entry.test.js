'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('production server entry exports PostgreSQL runtime without loading SQLite or listening on import', () => {
  const entry = path.resolve(__dirname, '..', 'server.js');
  const script = `process.env.NODE_ENV='production'; const app=require(${JSON.stringify(entry)}); process.stdout.write(JSON.stringify({postgres:typeof app.createApp==='function', sqlite:Object.keys(require.cache).some(p=>p.includes('node:sqlite'))}));`;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.dirname(entry), encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, 'production entry should load without starting a listener');
  assert.deepEqual(JSON.parse(result.stdout), { postgres: true, sqlite: false });
});

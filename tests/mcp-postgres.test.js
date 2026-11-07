'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPgAdapter, pgSql } = require('../mcp-server');

test('MCP PostgreSQL adapter uses numbered parameters and async pg rows', async () => {
  assert.equal(pgSql('SELECT ?, ?'), 'SELECT $1, $2');
  const calls = [];
  const adapter = createPgAdapter({
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ value: values[0] }], rowCount: 1 };
    }
  });
  assert.deepEqual(await adapter.prepare('SELECT ? AS value').get('safe'), { value: 'safe' });
  assert.deepEqual(calls[0], { sql: 'SELECT $1 AS value', values: ['safe'] });
});

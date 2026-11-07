'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mountMcpRoutes } = require('../mcp-server');

test('public and SSE MCP routes are not mounted in production', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const registered = [];
  const app = {
    get: path => registered.push(`GET ${path}`),
    post: path => registered.push(`POST ${path}`)
  };
  try {
    mountMcpRoutes(app, {});
    assert.deepEqual(registered, []);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

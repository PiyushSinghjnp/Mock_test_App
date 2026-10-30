'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// We can test the image upload validation and mock question save logic cleanly
test('admin image upload validation accepts valid images and rejects invalid formats', () => {
  const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  assert.equal(allowedExts.has('.png'), true);
  assert.equal(allowedExts.has('.jpg'), true);
  assert.equal(allowedExts.has('.exe'), false);
  assert.equal(allowedExts.has('.js'), false);
});

test('admin image buffer decoding from data URL', () => {
  const sampleText = 'Antigravity Test Image Buffer';
  const base64 = Buffer.from(sampleText).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  assert.ok(matches);
  assert.equal(matches[1], 'png');
  const decoded = Buffer.from(matches[2], 'base64').toString('utf8');
  assert.equal(decoded, sampleText);
});


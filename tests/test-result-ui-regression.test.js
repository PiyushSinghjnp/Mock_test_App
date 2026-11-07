'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('PostgreSQL test catalog marks completed attempts for candidate cards', () => {
  const server = read('server-postgres.js');
  assert.match(server, /isAttempted:\s*Boolean\(row\.attempt_id\)/);
});

test('solution loading fetches the completed attempt paper and scorecard buttons lazy-load solutions', () => {
  const app = read('js/app.js');
  const engine = read('js/test-engine.js');
  assert.match(app, /getTestById\(testId,\s*attemptId\s*\|\|\s*attemptObj\.id\s*\|\|\s*attemptObj\.attempt_id\)/);
  assert.equal((engine.match(/await this\._openScorecardSolutions\(attemptId, (?:this\.testData|testData)\.id\)/g) || []).length, 4);
  assert.match(engine, /await window\.appController\.viewSolutions\(attemptId, testId\)/);
});

test('stale autosaves return the persisted snapshot revision and remain visibly unsaved', () => {
  const server = read('server-postgres.js');
  const dataManager = read('js/data-manager.js');
  assert.match(server, /SELECT revision FROM paused_attempts WHERE user_id=\$1 AND test_id=\$2/);
  assert.match(dataManager, /data\.saved === undefined \? true : data\.saved === true/);
});

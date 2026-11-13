'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'test-engine.js'), 'utf8');

test('solution scorecard dismisses back to the already open solution console', () => {
  assert.match(source, /async _openScorecardSolutions\(attemptId, testId\)[\s\S]*?if \(window\.obSolutionEngine\?\.isOpen\) \{\s*this\.scorecardOverlay\?\.classList\.remove\('active'\);\s*return true;[\s\S]*?await window\.appController\.viewSolutions\(attemptId, testId\)/);
  assert.equal((source.match(/await this\._openScorecardSolutions\(attemptId,/g) || []).length, 4);
});

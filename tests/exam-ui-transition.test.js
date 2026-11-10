'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'test-engine.js'), 'utf8');

test('section confirmation stays visible until the server transition succeeds', () => {
  assert.match(engine, /async switchSection\(sectionIndex, resetSectionTimer = true, returnFromSummary = false\)/);
  assert.match(engine, /if \(this\.completedSections\.has\(sectionIndex\) && !returnFromSummary\) return;/);
  assert.match(engine, /if \(returnFromSummary\) this\.sBack\(\);\s*this\.currentSectionIndex = sectionIndex;/);
  assert.match(engine, /this\.switchSection\(nextSecIdx, true, true\)/);
  assert.match(engine, /Could not advance to the next section: \$\{error\.message\}/);
  assert.doesNotMatch(engine, /this\.sBack\(\);\s*if \(nextSecIdx < this\.testData\.sections\.length\)/);
});

test('autosave status remains available internally without an exam overlay', () => {
  assert.match(engine, /_setAutosaveStatus\(status\) \{\s*this\.autosaveStatus = status;\s*document\.getElementById\('test-autosave-status'\)\?\.remove\(\);/);
  assert.doesNotMatch(engine, /this\.autosaveIndicator\s*=\s*document\.createElement/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testEngineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'test-engine.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server-postgres.js'), 'utf8');

test('test-engine uses deadline-based timer instead of setInterval countdown', () => {
  // Should have totalDeadlineAt and sectionDeadlineAt properties
  assert.match(testEngineSource, /this\.totalDeadlineAt = null;/);
  assert.match(testEngineSource, /this\.sectionDeadlineAt = null;/);

  // Should have timerAnimationFrame for setTimeout-based timer
  assert.match(testEngineSource, /this\.timerAnimationFrame = null;/);

  // Should NOT use setInterval for timer countdown
  assert.ok(!testEngineSource.includes('this.timerInterval = setInterval(() => {'),
    'Should not use setInterval for timer countdown');
});

test('test-engine has stopTimer method for centralized cleanup', () => {
  assert.match(testEngineSource, /stopTimer\(\) \{[\s\S]*?clearTimeout\(this\.timerAnimationFrame\);[\s\S]*?cancelAnimationFrame\(this\.timerAnimationFrame\);/);
  assert.match(testEngineSource, /clearInterval\(this\.timerInterval\);/);

  const { OliveboardTestEngine } = require('../js/test-engine');
  const engine = new OliveboardTestEngine({ totalDurationSeconds: 1200, sections: [{ durationSeconds: 1200 }] });
  engine.timerAnimationFrame = setTimeout(() => {}, 10000);
  engine.timerInterval = setInterval(() => {}, 10000);
  engine.stopTimer();
  assert.equal(engine.timerAnimationFrame, null);
  assert.equal(engine.timerInterval, null);
});

test('test-engine has setServerDeadlines method', () => {
  assert.match(testEngineSource, /setServerDeadlines\(totalDeadlineAt, sectionDeadlineAt\) \{[\s\S]*?this\.totalDeadlineAt = totalDeadlineAt;/);
  assert.match(testEngineSource, /this\.sectionDeadlineAt = sectionDeadlineAt;/);
  assert.match(testEngineSource, /if \(this\.isExamActive\) \{[\s\S]*?this\.startTimer\(\);/);
});

test('test-engine converts server deadlines to monotonic deadlines once', () => {
  assert.match(testEngineSource, /this\.monotonicClockOffset = null;/);
  assert.match(testEngineSource, /if \(this\.monotonicClockOffset === null\) \{[\s\S]*?performance\.now\(\) - Date\.now\(\)/);
  assert.match(testEngineSource, /this\.totalMonotonicDeadline = this\.totalDeadlineAt \+ this\.monotonicClockOffset;/);
  assert.match(testEngineSource, /this\.sectionMonotonicDeadline = this\.sectionDeadlineAt \+ this\.monotonicClockOffset;/);
});

test('test-engine startTimer calculates remaining from monotonic deadlines', () => {
  assert.match(testEngineSource, /startTimer\(\) \{[\s\S]*?_startTimerFromDeadlines\(\);/);
  assert.match(testEngineSource, /_startTimerFromDeadlines\(\) \{[\s\S]*?const now = performance\.now\(\);/);
  assert.match(testEngineSource, /Math\.max\(0, Math\.ceil\(\(this\.totalMonotonicDeadline - now\) \/ 1000\)\)/);
  assert.match(testEngineSource, /Math\.max\(0, Math\.ceil\(\(this\.sectionMonotonicDeadline - now\) \/ 1000\)\)/);
});

test('test-engine _startTimerFromDeadlines aligns ticks to second boundaries', () => {
  assert.match(testEngineSource, /const delay = 1000 - \(now % 1000\);/);
  assert.match(testEngineSource, /this\.timerAnimationFrame = setTimeout\(tick, delay\);/);
});

test('test-engine _startLocalCountdownTimer is fallback when no deadlines', () => {
  assert.match(testEngineSource, /_startLocalCountdownTimer\(\) \{/);
  assert.match(testEngineSource, /if \(!this\.isExamActive \|\| this\.isPaused\) \{/);
});

test('server returns totalDeadlineAt and sectionDeadlineAt in timerResponse', () => {
  assert.match(serverSource, /function timerResponse\(row, timing\) \{[\s\S]*?const totalDeadlineMs = row\.total_deadline_at \? new Date\(row\.total_deadline_at\)\.getTime\(\) : null;/);
  assert.match(serverSource, /const sectionDeadlineMs = row\.section_deadline_at \? new Date\(row\.section_deadline_at\)\.getTime\(\) : null;/);
  assert.match(serverSource, /totalDeadlineAt: totalDeadlineMs, sectionDeadlineAt: sectionDeadlineMs/);
});

test('startActiveExam stores server deadlines', () => {
  assert.match(testEngineSource, /async startActiveExam\(isResume = false\) \{[\s\S]*?if \(timing\.totalDeadlineAt\) this\.totalDeadlineAt = timing\.totalDeadlineAt;/);
  assert.match(testEngineSource, /if \(timing\.sectionDeadlineAt\) this\.sectionDeadlineAt = timing\.sectionDeadlineAt;/);
});

test('resumeTest stores server deadlines', () => {
  assert.match(testEngineSource, /async resumeTest\(\) \{[\s\S]*?if \(data\.timing\.totalDeadlineAt\) this\.totalDeadlineAt = data\.timing\.totalDeadlineAt;/);
  assert.match(testEngineSource, /if \(data\.timing\.sectionDeadlineAt\) this\.sectionDeadlineAt = data\.timing\.sectionDeadlineAt;/);
});

test('switchSection stores server deadlines', () => {
  assert.match(testEngineSource, /async switchSection\(sectionIndex, resetSectionTimer = true, returnFromSummary = false\) \{[\s\S]*?if \(data\.timing\.totalDeadlineAt\) this\.totalDeadlineAt = data\.timing\.totalDeadlineAt;/);
  assert.match(testEngineSource, /if \(data\.timing\.sectionDeadlineAt\) this\.sectionDeadlineAt = data\.timing\.sectionDeadlineAt;/);
});

test('pauseTest and submitTest call stopTimer', async () => {
  assert.match(testEngineSource, /pauseTest\(\) \{[\s\S]*?this\.stopTimer\(\);/);
  assert.match(testEngineSource, /async submitTest\(\) \{[\s\S]*?this\.stopTimer\(\);/);

  const { OliveboardTestEngine } = require('../js/test-engine');
  const engine = new OliveboardTestEngine({ id: 'test-1', totalDurationSeconds: 1200, sections: [{ durationSeconds: 1200 }] });
  engine.isExamActive = true;
  engine.timerAnimationFrame = setTimeout(() => {}, 10000);

  // Verify handleSectionTimeout does not trigger while paused
  engine.isPaused = true;
  let sectionSwitched = false;
  engine.switchSection = () => { sectionSwitched = true; };
  engine.handleSectionTimeout();
  assert.equal(sectionSwitched, false, 'handleSectionTimeout must abort when paused');

  // Verify pauseTest recovers on server error
  global.window = {
    obDataManager: {
      pauseAttemptSession: async () => { throw new Error('Simulated network failure'); },
      pauseRevisions: new Map()
    },
    appController: {
      showToast: (msg, type) => { engine.lastToast = { msg, type }; }
    }
  };
  global.document = {
    getElementById: () => null
  };
  await engine.pauseTest();
  assert.equal(engine.isPaused, false);
  assert.equal(engine.autosaveStatus, 'Unable to pause test');
  assert.ok(engine.lastToast);
  assert.equal(engine.lastToast.type, 'error');
  engine.stopTimer();
  delete global.document;
  delete global.window;
});

test('_doExitTest calls stopTimer', () => {
  assert.match(testEngineSource, /_doExitTest\(skipRefresh = false\) \{[\s\S]*?this\.stopTimer\(\);/);
});

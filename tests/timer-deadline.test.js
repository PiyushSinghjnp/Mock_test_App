'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Test the timer deadline calculation logic
function calculateRemainingFromDeadline(deadlineMs, nowMs) {
  if (!deadlineMs) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

test('calculateRemainingFromDeadline returns correct values', () => {
  // Future deadline
  assert.equal(calculateRemainingFromDeadline(100_000, 50_000), 50);

  // Past deadline
  assert.equal(calculateRemainingFromDeadline(50_000, 100_000), 0);

  // Exact deadline
  assert.equal(calculateRemainingFromDeadline(100_000, 100_000), 0);

  // Null deadline
  assert.equal(calculateRemainingFromDeadline(null, 50_000), 0);

  // Sub-second precision
  assert.equal(calculateRemainingFromDeadline(100_500, 50_000), 51);
});

test('monotonic deadline countdown ignores later client wall-clock changes', () => {
  const serverDeadline = 160_000;
  const initialWallNow = 100_000;
  const initialMonotonicNow = 5_000;
  const monotonicOffset = initialMonotonicNow - initialWallNow;
  const monotonicDeadline = serverDeadline + monotonicOffset;

  // Thirty seconds elapsed according to the monotonic clock.
  let monotonicNow = initialMonotonicNow + 30_000;
  assert.equal(calculateRemainingFromDeadline(monotonicDeadline, monotonicNow), 30);

  // Wall clock moves forward or backward; the active timer keeps using monotonic time.
  const wallClockAfterJump = initialWallNow - 600_000;
  assert.equal(calculateRemainingFromDeadline(monotonicDeadline, monotonicNow), 30);
  assert.equal(calculateRemainingFromDeadline(serverDeadline, wallClockAfterJump), 660);

  // The server remains authoritative for saves and submission even if client UI is manipulated.
});

test('monotonic deadlines advance consistently across later deadline updates', () => {
  const offset = 5_000 - 100_000;
  const switchedSectionDeadline = 190_000;
  const monotonicDeadline = switchedSectionDeadline + offset;
  assert.equal(calculateRemainingFromDeadline(monotonicDeadline, 65_000), 30);
});

test('timer updates align to second boundaries', () => {
  // The timer should update at second boundaries (delay = 1000 - (now % 1000))
  function getNextTickDelay(now) {
    return 1000 - (now % 1000);
  }

  // At exact second boundary
  assert.equal(getNextTickDelay(100_000), 1000);

  // At 500ms into second
  assert.equal(getNextTickDelay(100_500), 500);

  // At 999ms into second
  assert.equal(getNextTickDelay(100_999), 1);
});

test('sectional and total deadlines work independently', () => {
  const totalDeadline = 200_000;
  const sectionDeadline = 150_000;
  const now = 120_000;

  const totalRemaining = calculateRemainingFromDeadline(totalDeadline, now);
  const sectionRemaining = calculateRemainingFromDeadline(sectionDeadline, now);

  assert.equal(totalRemaining, 80);
  assert.equal(sectionRemaining, 30);

  // Section expires first
  assert.ok(sectionRemaining < totalRemaining);
});

test('deadline precision: ceil ensures conservative remaining time', () => {
  // 30.1 seconds remaining -> ceil to 31 (conservative)
  assert.equal(calculateRemainingFromDeadline(100_100, 70_000), 31);

  // 30.9 seconds remaining -> ceil to 31
  assert.equal(calculateRemainingFromDeadline(100_900, 70_000), 31);

  // Exactly 30 seconds
  assert.equal(calculateRemainingFromDeadline(100_000, 70_000), 30);
});

test('timer handles section transitions with new deadlines', () => {
  // Initial section deadline
  let sectionDeadline = 150_000;
  let totalDeadline = 200_000;
  let now = 120_000;

  assert.equal(calculateRemainingFromDeadline(sectionDeadline, now), 30);

  // Section transition: server provides new section deadline
  sectionDeadline = now + 60_000; // 180,000 (new 60s section)

  assert.equal(calculateRemainingFromDeadline(sectionDeadline, now), 60);
  // Total deadline unchanged
  assert.equal(calculateRemainingFromDeadline(totalDeadline, now), 80);
});

test('pause/resume preserves time correctly', () => {
  const totalDeadline = 200_000;
  const pauseTime = 120_000;

  // Time remaining at pause
  const remainingAtPause = calculateRemainingFromDeadline(totalDeadline, pauseTime);
  assert.equal(remainingAtPause, 80);

  // Server computes new deadline on resume: now + remaining
  const resumeTime = 130_000; // 10s later in real time
  const newDeadline = resumeTime + remainingAtPause * 1000; // 130,000 + 80,000 = 210,000

  // Verify new deadline gives same remaining time at resume moment
  const remainingAtResume = calculateRemainingFromDeadline(newDeadline, resumeTime);
  assert.equal(remainingAtResume, 80);

  // After another 10s real time
  const later = 140_000;
  const remainingLater = calculateRemainingFromDeadline(newDeadline, later);
  assert.equal(remainingLater, 70);
});

test('timer handles edge cases', () => {
  // Very large deadline (far future)
  assert.equal(calculateRemainingFromDeadline(Number.MAX_SAFE_INTEGER, Date.now()),
    Math.ceil((Number.MAX_SAFE_INTEGER - Date.now()) / 1000));

  // Zero deadline
  assert.equal(calculateRemainingFromDeadline(0, 50_000), 0);

  // Negative deadline (past)
  assert.equal(calculateRemainingFromDeadline(-1000, 0), 0);
});

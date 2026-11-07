'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getTimingConfig, remainingSeconds, timerSnapshot } = require('../lib/exam-timer');

test('timer is based on trusted absolute deadlines and expires on refresh or client clock changes', () => {
  const row = { state: 'active', started_at: new Date(0), total_deadline_at: new Date(120_000),
    section_deadline_at: new Date(30_000), remaining_seconds: 120, section_remaining_seconds: 30,
    current_section_index: 0, completed_sections_json: '[]', revision: 0 };
  assert.equal(remainingSeconds(row.total_deadline_at, 120, row.state, 60_000), 60);
  assert.equal(timerSnapshot(row, 30_000).sectionRemainingSeconds, 0);
  assert.equal(timerSnapshot(row, 30_000).sectionExpired, true);
  assert.equal(timerSnapshot(row, 120_000).state, 'expired');
  assert.equal(timerSnapshot(row, 120_000).totalExpired, true);
  // Snapshot API has no client reported time argument: caller clock edits cannot extend a DB deadline.
  assert.equal(timerSnapshot(row, 120_000).remainingSeconds, 0);
});

test('pause freezes persisted time; resume uses a fresh server deadline', () => {
  assert.equal(remainingSeconds(null, 90, 'paused', 9_000_000), 90);
  assert.equal(remainingSeconds(new Date(150_000), 90, 'active', 100_000), 50);
});

test('independent candidates and tests retain independent sectional timing policies', () => {
  const testA = getTimingConfig({ duration_minutes: 60, test_data_json: JSON.stringify({
    hasSectionalTiming: true, isSectionalLocked: true, sections: [{ durationMinutes: 20 }, { durationMinutes: 40 }]
  }) });
  const testB = getTimingConfig({ duration_minutes: 45, test_data_json: JSON.stringify({
    hasSectionalTiming: false, isSectionalLocked: false, sections: [{ durationMinutes: 10 }, { durationMinutes: 10 }]
  }) });
  assert.deepEqual(testA.sectionDurations, [1200, 2400]);
  assert.equal(testA.isSectionalLocked, true);
  assert.deepEqual(testB.sectionDurations, [2700]);
  assert.equal(testB.isSectionalLocked, false);
  const rowA = { state: 'active', total_deadline_at: new Date(100_000), section_deadline_at: new Date(20_000), remaining_seconds: 100, section_remaining_seconds: 20, current_section_index: 0, completed_sections_json: '[]' };
  const rowB = { ...rowA, total_deadline_at: new Date(200_000), section_deadline_at: new Date(90_000) };
  assert.equal(timerSnapshot(rowA, 50_000).remainingSeconds, 50);
  assert.equal(timerSnapshot(rowB, 50_000).remainingSeconds, 150);
});

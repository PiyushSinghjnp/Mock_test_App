'use strict';

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function positiveSeconds(value, fallback) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86_400, Math.ceil(seconds)) : fallback;
}

function getTimingConfig(testRow) {
  if (testRow && testRow._timingConfig) return testRow._timingConfig;
  const paper = (testRow && testRow._parsedPaper) ? testRow._parsedPaper : parseJson(testRow.test_data_json, {});
  const durationSeconds = positiveSeconds(paper.totalDurationSeconds, positiveSeconds(Number(testRow.duration_minutes) * 60, 3600));
  const hasSectionalTiming = paper.hasSectionalTiming !== false;
  const sections = Array.isArray(paper.sections) ? paper.sections : [];
  const sectionDurations = sections.map(section => positiveSeconds(section.durationSeconds,
    positiveSeconds(Number(section.durationMinutes) * 60, durationSeconds)));
  return {
    durationSeconds,
    hasSectionalTiming,
    isSectionalLocked: paper.isSectionalLocked !== false && hasSectionalTiming,
    sectionDurations: hasSectionalTiming ? sectionDurations : [durationSeconds]
  };
}

function remainingSeconds(deadline, storedSeconds, state, now = Date.now()) {
  if (state !== 'active' || !deadline) return Math.max(0, Number(storedSeconds) || 0);
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : Date.parse(deadline);
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}

function timerSnapshot(row, now = Date.now()) {
  if (!row) return null;
  const remaining = remainingSeconds(row.total_deadline_at, row.remaining_seconds, row.state, now);
  const sectionRemaining = remainingSeconds(row.section_deadline_at, row.section_remaining_seconds, row.state, now);
  return {
    state: row.state === 'active' && remaining <= 0 ? 'expired' : row.state,
    totalExpired: row.state === 'active' && remaining <= 0,
    sectionExpired: row.state === 'active' && sectionRemaining <= 0,
    remainingSeconds: remaining,
    sectionRemainingSeconds: sectionRemaining,
    currentSectionIndex: Number(row.current_section_index) || 0,
    completedSections: parseJson(row.completed_sections_json, []),
    revision: Number(row.revision) || 0,
    startedAt: row.started_at
  };
}

module.exports = { getTimingConfig, remainingSeconds, timerSnapshot };

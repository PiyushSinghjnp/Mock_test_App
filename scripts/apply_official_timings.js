/**
 * Script: apply_official_timings.js
 * Ingests 2026 official notification sectional timings, durations, and marking schemes
 * from /js/exam-patterns-2026.js and /data/official_exam_notifications.json into database.sqlite
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const examPatterns2026 = require('../js/exam-patterns-2026');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const notifPath = path.join(__dirname, '..', 'data', 'official_exam_notifications.json');
const notifications = JSON.parse(fs.readFileSync(notifPath, 'utf8'));

console.log(`Loaded 2026 official exam notifications (v${notifications.version}) from`, notifPath);

const tests = db.prepare('SELECT id, exam_id, type, title, subtitle, test_data_json FROM tests').all();
const updateStmt = db.prepare(`
  UPDATE tests
  SET test_data_json = ?,
      sections_summary_json = ?,
      duration_minutes = ?,
      marks = ?,
      marks_per_correct = ?,
      negative_marks = ?
  WHERE id = ?
`);

for (const testRow of tests) {
  const testId = testRow.id;
  const examId = testRow.exam_id;
  const testType = testRow.type === 'sectional' ? 'prelims' : (testRow.type || 'prelims');
  const rawTestData = JSON.parse(testRow.test_data_json);

  const updated = examPatterns2026.apply2026PatternToQuestionPaper(rawTestData, {
    testId: testId,
    examId: examId,
    stage: testType === 'mains' ? 'mains' : 'prelims',
    title: testRow.title,
    subtitle: testRow.subtitle
  });

  // Preserve sectional type if it was a single sectional test
  if (testRow.type === 'sectional') {
    updated.type = 'sectional';
  }

  updateStmt.run(
    JSON.stringify(updated),
    JSON.stringify(updated.sectionsSummary),
    updated.durationMinutes,
    updated.marks,
    updated.marksPerCorrect,
    updated.negativeMarks,
    testId
  );

  console.log(`✔ Updated ${testId} (${updated.title}): ${updated.questionsCount} Qs, ${updated.durationMinutes}m, +${updated.marksPerCorrect}/-${updated.negativeMarks}`);
}

console.log('All 2026 official exam notification sectional timings and marking schemes applied!');

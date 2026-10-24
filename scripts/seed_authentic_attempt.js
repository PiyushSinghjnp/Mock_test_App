const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const attemptId = 'att-ibps-so-it-prelims-1-authentic';
const now = new Date().toISOString();

const responses = {
  '51': { selectedIndex: 0, status: 'stic-answered', timeSpentSeconds: 16 },
  'ibps-q-51': { selectedIndex: 0, status: 'stic-answered', timeSpentSeconds: 16 }
};

const sectionBreakdown = [
  { sectionName: 'English Language', total: 25, correct: 0, wrong: 0, unanswered: 25, score: 0, accuracy: 0 },
  { sectionName: 'Reasoning Ability', total: 25, correct: 0, wrong: 0, unanswered: 25, score: 0, accuracy: 0 },
  { sectionName: 'Quantitative Aptitude', total: 25, correct: 0, wrong: 1, unanswered: 24, score: -0.25, accuracy: 0 },
  { sectionName: 'Professional Knowledge', total: 25, correct: 0, wrong: 0, unanswered: 25, score: 0, accuracy: 0 }
];

db.prepare(`
  INSERT INTO test_attempts (
    id, user_id, test_id, test_title, total_questions,
    score, max_score, correct_count, wrong_count, unanswered_count,
    accuracy, percentile, estimated_air, time_spent_seconds,
    section_breakdown_json, responses_json, started_at, completed_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    score = excluded.score,
    accuracy = excluded.accuracy,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    unanswered_count = excluded.unanswered_count,
    time_spent_seconds = excluded.time_spent_seconds,
    section_breakdown_json = excluded.section_breakdown_json,
    responses_json = excluded.responses_json
`).run(
  attemptId,
  'user-rahul',
  'ibps-so-it-prelims-1',
  'IBPS SO Prelims [IT] - Free Mock 1',
  100,
  -0.25,
  125,
  0,
  1,
  99,
  0,
  14.2,
  142,
  34,
  JSON.stringify(sectionBreakdown),
  JSON.stringify(responses),
  now,
  now
);

console.log('Successfully seeded authentic attempt for ibps-so-it-prelims-1');

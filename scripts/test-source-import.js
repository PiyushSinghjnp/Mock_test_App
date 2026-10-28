// Run with: node --test scripts/test-source-import.js
// Uses pure normalization, an in-memory watcher, and an ephemeral asset-only app.
// Never opens the application's SQLite database or imports a paper.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const patterns = require('../js/exam-patterns-2026');

function sourcePaper() {
  return {
    schemaVersion: 1,
    id: 'live-ob-fixture',
    source: { provider: 'oliveboard', url: 'https://u1.oliveboard.in/tests/?c=uiicao&t=1', evidenceId: 'test-evidence' },
    completeness: { complete: true },
    title: 'UIIC AO source fixture',
    examId: 'uiic-ao',
    examName: 'UIIC AO',
    type: 'mains',
    hasSectionalTiming: false,
    totalDurationSeconds: 5400,
    expectedQuestions: 2,
    sections: [{
      id: 'gk', title: 'General Knowledge', marksForCorrect: 2, negativeMarks: 0.5,
      questions: [1, 2].map(qid => ({ qid, questionHTML: '<p>Source question</p>', options: ['First option', 'Second option'], correctAnswer: 'B' }))
    }]
  };
}

test('source paper preserves exam, section, marks, duration, and stable identity', () => {
  const raw = sourcePaper();
  const result = patterns.apply2026PatternToQuestionPaper(raw);
  assert.equal(result.examId, 'uiic-ao');
  assert.equal(result.sections[0].title, 'General Knowledge');
  assert.equal(result.durationMinutes, 90);
  assert.equal(result.sections[0].marksForCorrect, 2);
  assert.equal(result.marks, 4);
  assert.equal(result.sections[0].questions[0].qid, 1);
  assert.equal(result.sections[0].questions[0].correctIndex, 1);
  const id = result.sections[0].questions[0].id;
  raw.sections[0].questions.reverse();
  const reordered = patterns.normalizeSourceQuestionPaper(raw);
  assert.equal(reordered.sections[0].questions[1].id, id);
});

test('source paper blocks partial, missing, duplicate, and contradictory data', () => {
  const cases = [
    p => { p.completeness.complete = false; },
    p => { p.expectedQuestions = 3; },
    p => { delete p.source.evidenceId; },
    p => { delete p.sections[0].negativeMarks; },
    p => { delete p.totalDurationSeconds; },
    p => { delete p.sections[0].questions[0].correctAnswer; },
    p => { p.sections[0].questions[0].correctIndex = 0; },
    p => { p.sections[0].questions[0].correctAnswer = 'E'; },
    p => { p.sections[0].questions[1].qid = 1; },
    p => { p.source.url = 'https://oliveboard.in.attacker.example/'; }
  ];
  for (const change of cases) {
    const raw = sourcePaper();
    change(raw);
    assert.throws(() => patterns.normalizeSourceQuestionPaper(raw), /not ready to import/);
  }
});

test('unknown and conflicting answers stay unknown rather than becoming A or B', () => {
  const opts = [{ text: 'First' }, { text: 'Second' }];
  assert.equal(patterns.normalizeCorrectIndex({}, opts), null);
  assert.equal(patterns.normalizeCorrectIndex({ correctAnswer: 'A', correctIndex: 1 }, opts), null);
  assert.equal(patterns.normalizeCorrectIndex({ correctIndex: 7 }, opts), null);
  assert.equal(patterns.normalizeCorrectIndex({ correctAnswer: '1garbage' }, opts), null);
  assert.equal(patterns.normalizeCorrectIndex({ correctAnswer: '2' }, opts), 1);
  assert.equal(patterns.normalizeCorrectIndex({ correctAnswer: 'A', correctIndex: 0 }, opts), 0);
});

test('sectional source duration is preserved independently for every section', () => {
  const raw = sourcePaper();
  raw.hasSectionalTiming = true;
  raw.sections[0].durationSeconds = 420;
  raw.sections.push({ ...raw.sections[0], id: 'quant', title: 'Quantitative', durationSeconds: 840, questions: [{ ...raw.sections[0].questions[0], qid: 3 }] });
  raw.expectedQuestions = 3;
  const result = patterns.normalizeSourceQuestionPaper(raw);
  assert.equal(result.totalDurationSeconds, 1260);
  assert.deepEqual(result.sections.map(s => s.durationSeconds), [420, 840]);
});

test('paper watcher schedules different filenames independently', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = code.indexOf('  const pendingPaperImports = new Map();');
  const end = code.indexOf('\n} catch (e)', start);
  assert.ok(start > 0 && end > start);
  const timers = new Map();
  const imported = [];
  let watchCallback;
  let nextTimer = 0;
  const context = {
    fs: { watch: (_dir, callback) => { watchCallback = callback; }, existsSync: () => true },
    path,
    PAPERS_DIR: 'fixture-papers',
    ingestBackendPaperFile: file => imported.push(path.basename(file)),
    clearTimeout: id => timers.delete(id),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }
  };
  vm.runInNewContext(code.slice(start, end), context);
  watchCallback('rename', 'first.json');
  watchCallback('change', 'first.json');
  watchCallback('rename', 'second.json');
  assert.equal(timers.size, 2);
  for (const callback of timers.values()) callback();
  assert.deepEqual(imported.sort(), ['first.json', 'second.json']);
});

test('asset server serves the app but not databases, papers, captures, or server source', async t => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const end = code.indexOf('// ==========================================');
  const context = vm.createContext({ require, __dirname: path.join(__dirname, '..'), process, console });
  vm.runInContext(code.slice(0, end), context);
  const app = vm.runInContext('app', context);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/database.sqlite', '/server.js', '/scraped/.cookie_jar.json', '/scraped/live_capture_mock_test_1793096018420.html', '/papers/fixture.json', '/.git/config']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/js/exam-patterns-2026.js')).status, 200);
});

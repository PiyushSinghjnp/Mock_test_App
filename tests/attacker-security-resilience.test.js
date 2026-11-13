'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const dbPostgres = require('../db/postgres');
const { createSession, digest } = require('../db/auth');
const { createApp, scorePaper, scrubSolutions } = require('../server-postgres');
const { getTimingConfig } = require('../lib/exam-timer');

test('scrubSolutions strips all answer key and explanation variants recursively', () => {
  const rawPaper = {
    id: 'test-scrub',
    answerKey: { q1: 'A' },
    answer_key: { q1: 0 },
    sections: [{
      title: 'Quant',
      questions: [{
        id: 'q1',
        questionText: '2 + 2 = ?',
        options: ['3', '4', '5', '6'],
        correctIndex: 1,
        correct_index: 1,
        correctAnswer: 'B',
        correct_answer: 'B',
        answer: 'B',
        correctOption: 1,
        correct_option: 1,
        explanation: '2+2 is 4',
        explanationHTML: '<p>2+2 is 4</p>',
        explanation_html: '<p>2+2 is 4</p>',
        solution: 'Add 2 and 2',
        solutionHTML: '<p>Add 2 and 2</p>',
        solution_html: '<p>Add 2 and 2</p>'
      }]
    }]
  };

  const scrubbed = scrubSolutions(rawPaper);
  assert.equal(scrubbed.answerKey, undefined);
  assert.equal(scrubbed.answer_key, undefined);
  const q = scrubbed.sections[0].questions[0];
  for (const forbidden of [
    'correctIndex', 'correct_index', 'correctAnswer', 'correct_answer',
    'answer', 'correctOption', 'correct_option', 'explanation',
    'explanationHTML', 'explanation_html', 'solution', 'solutionHTML', 'solution_html'
  ]) {
    assert.equal(q[forbidden], undefined, `${forbidden} must be stripped from unsubmitted paper`);
  }
  assert.deepEqual(q.options, ['3', '4', '5', '6']);
});

test('scorePaper resists Object.prototype key collisions and clamps extreme inputs', () => {
  const testRow = {
    marks: 2,
    marks_per_correct: 1,
    negative_marks: 0.25,
    test_data_json: JSON.stringify({
      sections: [{
        title: 'Security',
        questions: [
          { id: 'toString', questionNumber: 'valueOf', options: ['a', 'b'], correctIndex: 0 },
          { id: 'constructor', questionNumber: '__proto__', options: ['a', 'b'], correctIndex: 1 }
        ]
      }]
    })
  };

  // Empty responses object must not read Object.prototype.toString or constructor
  const blankResult = scorePaper(testRow, {});
  assert.deepEqual(blankResult.counts, { correct: 0, wrong: 0, unanswered: 2 });
  assert.equal(blankResult.score, 0);

  // Array or primitive submitted responses must be treated safely as empty map
  assert.deepEqual(scorePaper(testRow, [0, 1]).counts, { correct: 0, wrong: 0, unanswered: 2 });
  assert.deepEqual(scorePaper(testRow, 'malicious').counts, { correct: 0, wrong: 0, unanswered: 2 });

  // Pre-parsed _parsedPaper fast path produces identical authoritative results
  const parsedRow = { ...testRow, _parsedPaper: JSON.parse(testRow.test_data_json), test_data_json: 'INVALID_IF_REPRASED' };
  const fastResult = scorePaper(parsedRow, { toString: { selectedIndex: 0, timeSpentSeconds: 9999999 } });
  assert.equal(fastResult.score, 1);
  assert.equal(fastResult.normalizedResponses.toString.timeSpentSeconds, 86400);
});

test('getTimingConfig uses pre-cached _timingConfig or _parsedPaper without re-parsing JSON', () => {
  const precomputed = { durationSeconds: 1200, hasSectionalTiming: true, isSectionalLocked: true, sectionDurations: [600, 600] };
  assert.equal(getTimingConfig({ _timingConfig: precomputed, test_data_json: '{bad' }), precomputed);

  const fromParsed = getTimingConfig({
    duration_minutes: 20,
    _parsedPaper: { hasSectionalTiming: true, isSectionalLocked: true, sections: [{ durationSeconds: 600 }, { durationSeconds: 600 }] },
    test_data_json: '{bad'
  });
  assert.deepEqual(fromParsed, precomputed);
});

test('attacker simulation: auth, CSRF, origin, IDOR, overflow, cache stampede, and gzip defenses', async t => {
  const origGetPool = dbPostgres.getPool;
  const origTransaction = dbPostgres.transaction;
  const adminToken = crypto.randomBytes(32).toString('hex');
  const prevAdmin = process.env.OLIVEBOARD_ADMIN_TOKEN;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.OLIVEBOARD_ADMIN_TOKEN = adminToken;
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');

  const users = new Map();
  const sessions = new Map();
  const paused = new Map();
  const activeTimers = new Map();
  const attempts = new Map();
  let testSelectCount = 0;

  const samplePaper = {
    id: 'mock-sec-1',
    title: 'Security Mock 1',
    hasSectionalTiming: true,
    isSectionalLocked: true,
    sections: [
      { title: 'Reasoning', durationSeconds: 600, questions: [{ id: 'q1', options: ['A', 'B', 'C', 'D'], correctIndex: 2, explanationHTML: 'Secret 1' }] },
      { title: 'Quant', durationSeconds: 600, questions: [{ id: 'q2', options: ['A', 'B', 'C', 'D'], correctIndex: 3, explanationHTML: 'Secret 2' }] }
    ]
  };
  const sampleTestRow = {
    id: 'mock-sec-1',
    exam_id: 'sbi-po',
    exam_name: 'SBI PO',
    type: 'mock',
    title: 'Security Mock 1',
    marks: 2,
    questions_count: 2,
    duration_minutes: 20,
    marks_per_correct: 1,
    negative_marks: 0.25,
    is_free: 1,
    sections_summary_json: JSON.stringify([{ title: 'Reasoning', questionsCount: 1 }, { title: 'Quant', questionsCount: 1 }]),
    test_data_json: JSON.stringify(samplePaper)
  };

  // Seed two candidates: victim and attacker
  const victim = { id: 'user-victim', username: 'victim', name: 'Victim User', coins: 300, streak_days: 2, target_exam: 'sbi-po' };
  const attacker = { id: 'user-attacker', username: 'attacker', name: 'Attacker User', coins: 300, streak_days: 1, target_exam: 'sbi-po' };
  users.set(victim.id, victim);
  users.set(attacker.id, attacker);

  attempts.set('att-victim-1', {
    id: 'att-victim-1',
    user_id: victim.id,
    test_id: 'mock-sec-1',
    score: 2,
    max_score: 2,
    section_breakdown_json: '[]',
    responses_json: '{}'
  });

  const mockClient = {
    release() {},
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rowCount: 0, rows: [] };
      }
      if (normalized.startsWith('INSERT INTO auth_sessions')) {
        const [sessionHash, csrfHash, userId, expiresAt] = params;
        sessions.set(sessionHash, { session_hash: sessionHash, csrf_hash: csrfHash, user_id: userId, expires_at: expiresAt });
        return { rowCount: 1, rows: [] };
      }
      if (normalized.includes('FROM auth_sessions s JOIN users u')) {
        const sess = sessions.get(params[0]);
        if (!sess) return { rowCount: 0, rows: [] };
        const u = users.get(sess.user_id);
        return { rowCount: 1, rows: [{ ...u, ...sess, user_id: u.id }] };
      }
      if (normalized.startsWith('UPDATE auth_sessions SET last_seen_at=NOW()')) {
        return { rowCount: 1, rows: [] };
      }
      if (normalized.startsWith('SELECT * FROM tests WHERE LOWER(id)=LOWER($1)')) {
        testSelectCount++;
        await new Promise(r => setTimeout(r, 15));
        if (String(params[0]).toLowerCase() === 'mock-sec-1') return { rowCount: 1, rows: [sampleTestRow] };
        return { rowCount: 0, rows: [] };
      }
      if (normalized.startsWith('SELECT t.*, EXISTS(SELECT 1 FROM test_attempts')) {
        testSelectCount++;
        const [testId, attemptId, userId] = params;
        if (String(testId).toLowerCase() !== 'mock-sec-1') return { rowCount: 0, rows: [] };
        const att = attempts.get(attemptId);
        const completed = Boolean(att && att.user_id === userId && att.test_id === 'mock-sec-1');
        return { rowCount: 1, rows: [{ ...sampleTestRow, completed }] };
      }
      if (normalized.startsWith('SELECT 1 FROM test_attempts WHERE id=$1 AND user_id=$2 AND test_id=$3')) {
        const [attemptId, userId, testId] = params;
        const att = attempts.get(attemptId);
        const ok = Boolean(att && att.user_id === userId && att.test_id === testId);
        return { rowCount: ok ? 1 : 0, rows: ok ? [{ '?column?': 1 }] : [] };
      }
      if (normalized.startsWith('SELECT id, title, type, marks, duration_minutes, marks_per_correct, negative_marks FROM tests WHERE id=$1 FOR SHARE')) {
        if (params[0] !== 'mock-sec-1') return { rowCount: 0, rows: [] };
        const { test_data_json, ...scalar } = sampleTestRow;
        return { rowCount: 1, rows: [scalar] };
      }
      if (normalized.startsWith('SELECT s.*,clock_timestamp() AS evaluated_at FROM active_test_sessions s')) {
        const key = `${params[0]}:${params[1]}`;
        const row = activeTimers.get(key);
        return { rowCount: row ? 1 : 0, rows: row ? [{ ...row, evaluated_at: new Date().toISOString() }] : [] };
      }
      if (normalized.startsWith('SELECT current_section_index,completed_sections_json,remaining_seconds,section_remaining_seconds FROM paused_attempts')) {
        const row = paused.get(`${params[0]}:${params[1]}`);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (normalized.startsWith('INSERT INTO active_test_sessions')) {
        const [userId, testId, remaining, sectionRemaining, sectionIndex, completedJson, submissionKey] = params;
        const now = Date.now();
        activeTimers.set(`${userId}:${testId}`, {
          user_id: userId,
          test_id: testId,
          state: 'active',
          started_at: new Date(now).toISOString(),
          total_deadline_at: new Date(now + remaining * 1000).toISOString(),
          section_deadline_at: new Date(now + sectionRemaining * 1000).toISOString(),
          remaining_seconds: remaining,
          section_remaining_seconds: sectionRemaining,
          current_section_index: sectionIndex,
          completed_sections_json: completedJson,
          revision: 1,
          submission_key: submissionKey
        });
        return { rowCount: 1, rows: [] };
      }
      if (normalized.startsWith('INSERT INTO paused_attempts')) {
        const [userId, testId, secIdx, qIdx, lastQ, secRem, rem, compJson, respJson, bookJson, rev] = params;
        // Verify integer bounds like PostgreSQL INTEGER column (-2147483648..2147483647)
        for (const intVal of [secIdx, qIdx, lastQ]) {
          if (!Number.isInteger(intVal) || intVal < 0 || intVal > 2147483647) {
            throw new Error(`PostgreSQL integer out of range: ${intVal}`);
          }
        }
        const key = `${userId}:${testId}`;
        const existing = paused.get(key);
        if (existing && existing.revision >= rev) {
          return { rowCount: 0, rows: [] };
        }
        const entry = {
          user_id: userId,
          test_id: testId,
          current_section_index: secIdx,
          current_question_index: qIdx,
          last_question_number: lastQ,
          section_remaining_seconds: secRem,
          remaining_seconds: rem,
          completed_sections_json: compJson,
          responses_json: respJson,
          bookmarked_json: bookJson,
          updated_at: new Date().toISOString(),
          revision: rev
        };
        paused.set(key, entry);
        return { rowCount: 1, rows: [{ revision: rev }] };
      }
      if (normalized.startsWith('SELECT revision FROM paused_attempts')) {
        const row = paused.get(`${params[0]}:${params[1]}`);
        return { rowCount: row ? 1 : 0, rows: row ? [{ revision: row.revision }] : [] };
      }
      if (normalized.startsWith('SELECT * FROM paused_attempts WHERE user_id=$1 AND test_id=$2')) {
        const row = paused.get(`${params[0]}:${params[1]}`);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (normalized.startsWith('SELECT a.*,t.type AS test_type FROM test_attempts a LEFT JOIN tests t ON t.id=a.test_id WHERE a.id=$1 AND a.user_id=$2')) {
        const att = attempts.get(params[0]);
        if (!att || att.user_id !== params[1]) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [att] };
      }
      if (normalized.startsWith('SELECT a.*,t.type AS test_type FROM test_attempts a LEFT JOIN tests t ON t.id=a.test_id WHERE a.user_id=$1')) {
        for (const p of params) {
          if (typeof p !== 'string') throw new Error(`Expected string parameter, got ${typeof p}`);
        }
        return { rowCount: 0, rows: [] };
      }
      if (normalized.includes('FROM tests t LEFT JOIN LATERAL')) {
        if (params[0] !== null && typeof params[0] !== 'string') throw new Error('Invalid examId param type');
        return { rowCount: 1, rows: [sampleTestRow] };
      }
      if (normalized.includes('FROM users u JOIN LATERAL')) {
        for (const p of params) {
          if (typeof p !== 'string') throw new Error('Invalid leaderboard examId param type');
        }
        return { rowCount: 0, rows: [] };
      }
      if (normalized.includes('FROM auth_login_limits')) {
        return { rowCount: 1, rows: [{ blocked: false }] };
      }
      if (normalized.startsWith('INSERT INTO auth_login_limits')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }
  };

  const prevDbUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/testdb';
  const pool = dbPostgres.getPool();
  const origPoolQuery = pool.query;
  const origPoolConnect = pool.connect;
  pool.query = (sql, params) => mockClient.query(sql, params);
  pool.connect = async () => ({
    query: (sql, params) => mockClient.query(sql, params),
    release() {}
  });

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    pool.query = origPoolQuery;
    pool.connect = origPoolConnect;
    await dbPostgres.closePool();
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prevDbUrl;
    if (prevAdmin === undefined) delete process.env.OLIVEBOARD_ADMIN_TOKEN; else process.env.OLIVEBOARD_ADMIN_TOKEN = prevAdmin;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSecret;
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const attackerSess = await createSession(mockClient, attacker.id);
  const victimSess = await createSession(mockClient, victim.id);
  const attackerCookie = `ob_session=${encodeURIComponent(attackerSess.token)}`;
  const authHeaders = {
    cookie: attackerCookie,
    origin: base,
    'x-csrf-token': attackerSess.csrfToken,
    'content-type': 'application/json'
  };

  // 1. Internal directories (/lib, /scraped, /papers) must not be publicly served as raw assets
  for (const internalPath of ['/lib/exam-timer.js', '/scraped/manifest.json', '/papers/manifest.json']) {
    const res = await fetch(`${base}${internalPath}`);
    assert.equal(res.status, 404, `${internalPath} must not be publicly exposed`);
  }

  // 2. Admin routes reject missing, short, and wrong-value tokens
  for (const badToken of ['', 'short', '0'.repeat(adminToken.length)]) {
    const res = await fetch(`${base}/api/quizzes/bank-summary`, {
      headers: badToken ? { 'x-admin-token': badToken } : {}
    });
    assert.equal(res.status, 401);
  }

  // 3. Cross-origin and missing/forged CSRF attacks are blocked with 403
  const evilOriginRes = await fetch(`${base}/api/attempts/session/start`, {
    method: 'POST',
    headers: { ...authHeaders, origin: 'https://evil-attacker.example' },
    body: JSON.stringify({ testId: 'mock-sec-1' })
  });
  assert.equal(evilOriginRes.status, 403);

  const badCsrfRes = await fetch(`${base}/api/attempts/session/start`, {
    method: 'POST',
    headers: { ...authHeaders, 'x-csrf-token': victimSess.csrfToken },
    body: JSON.stringify({ testId: 'mock-sec-1' })
  });
  assert.equal(badCsrfRes.status, 403);

  // 4. Oversized password DoS (> 1024 chars) is rejected without crashing
  const hugePassword = 'A'.repeat(50_000);
  const loginDosRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'attacker', password: hugePassword })
  });
  assert.equal(loginDosRes.status, 401);

  const registerDosRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'newuser', password: hugePassword })
  });
  assert.equal(registerDosRes.status, 400);

  // 5. Query array/object parameter pollution does not cause 500 errors
  for (const pollutedUrl of [
    '/api/tests?examId[]=sbi-po&examId[]=ibps-po',
    '/api/leaderboard?examId[]=sbi-po&examId[]=ibps-po',
    '/api/attempts?testId[]=mock-sec-1&testId[]=mock-sec-2'
  ]) {
    const res = await fetch(`${base}${pollutedUrl}`, { headers: { cookie: attackerCookie } });
    assert.equal(res.status, 200, `${pollutedUrl} must not throw 500`);
  }

  // 6. Concurrent cache stampede on GET /api/tests/:id coalesces DB queries and scrubs solutions
  testSelectCount = 0;
  const concurrentReads = await Promise.all(
    Array.from({ length: 8 }, () => fetch(`${base}/api/tests/mock-sec-1`, { headers: { cookie: attackerCookie } }).then(r => r.json()))
  );
  assert.equal(testSelectCount, 1, '8 concurrent cold reads must coalesce into a single DB query');
  for (const payload of concurrentReads) {
    assert.equal(payload.success, true);
    assert.equal(payload.test.sections[0].questions[0].correctIndex, undefined);
    assert.equal(payload.test.sections[0].questions[0].explanationHTML, undefined);
  }

  // 7. IDOR attempt: Attacker passing Victim's completed attemptId to GET /api/tests/:id still gets scrubbed paper
  const idorPaperRes = await fetch(`${base}/api/tests/mock-sec-1?attemptId=att-victim-1`, {
    headers: { cookie: attackerCookie }
  });
  const idorPaper = await idorPaperRes.json();
  assert.equal(idorPaperRes.status, 200);
  assert.equal(idorPaper.test.sections[0].questions[0].correctIndex, undefined, 'IDOR attemptId must not unlock answers');

  // 8. IDOR attempt: Attacker reading Victim's attempt or patching Victim's user profile fails
  const idorAttemptRes = await fetch(`${base}/api/attempts/att-victim-1`, { headers: { cookie: attackerCookie } });
  assert.equal(idorAttemptRes.status, 404);

  const idorUserPatch = await fetch(`${base}/api/users/${victim.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Hacked Name' })
  });
  assert.equal(idorUserPatch.status, 403);

  // 9. Start session & test GET /api/paused-attempts when paused_attempts row does not exist yet
  const startRes = await fetch(`${base}/api/attempts/session/start`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ testId: 'mock-sec-1' })
  });
  assert.equal(startRes.status, 200);

  const initialPausedRes = await fetch(`${base}/api/paused-attempts?testId=mock-sec-1`, {
    headers: { cookie: attackerCookie }
  });
  assert.equal(initialPausedRes.status, 200);
  const initialPaused = await initialPausedRes.json();
  assert.equal(initialPaused.pausedAttempt.currentSectionIndex, 0);

  // 10. Overflow, float, negative, and non-object tampering on POST /api/paused-attempts
  const tamperedSaveRes = await fetch(`${base}/api/paused-attempts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      testId: 'mock-sec-1',
      revision: 1e30, // Unsafe integer overflow attempt
      currentSectionIndex: 99, // Attempt to spoof section index
      currentQuestionIndex: 9999999999999, // > 32-bit int overflow attempt
      lastQuestionNumber: -500, // Negative question number attempt
      remainingSeconds: 9999999, // Attempt to extend timer
      responses: ['array-instead-of-object'],
      bookmarkedQuestions: 'string-instead-of-object'
    })
  });
  assert.equal(tamperedSaveRes.status, 200);
  const tamperedSave = await tamperedSaveRes.json();
  assert.equal(tamperedSave.revision, 1, 'Unsafe revision must clamp to 1');
  assert.ok(tamperedSave.timing.remainingSeconds <= 1200, 'Client remainingSeconds must not extend server deadline');

  const verifySaved = paused.get(`${attacker.id}:mock-sec-1`);
  assert.equal(verifySaved.current_section_index, 0, 'Section index must come from server timer');
  assert.equal(verifySaved.current_question_index, 10000, 'Huge question index must be clamped safely');
  assert.equal(verifySaved.last_question_number, 1, 'Negative lastQuestionNumber must clamp to 1');
  assert.equal(verifySaved.responses_json, '{}', 'Array responses must be sanitized to {}');
  assert.equal(verifySaved.bookmarked_json, '{}', 'String bookmarks must be sanitized to {}');

  // 11. Section transition tampering: null/empty/boolean/array targetSectionIndex and locked section jump
  for (const invalidTarget of [null, '', false, true, [], {}, 1.5, -1, 99]) {
    const secRes = await fetch(`${base}/api/attempts/session/section`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ testId: 'mock-sec-1', targetSectionIndex: invalidTarget })
    });
    assert.equal(secRes.status, 400, `targetSectionIndex=${JSON.stringify(invalidTarget)} must return 400`);
  }

  // 12. Gzip compression works on large JSON responses when Accept-Encoding: gzip is sent
  const gzipRes = await fetch(`${base}/api/exam-patterns-2026`, {
    headers: { 'accept-encoding': 'gzip' }
  });
  assert.equal(gzipRes.status, 200);
  const patternsData = await gzipRes.json();
  assert.equal(patternsData.success, true);
  assert.ok(patternsData.patterns);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config();
const { getPool, closePool } = require('../db/postgres');
const { digest } = require('../db/auth');
const { createApp } = require('../server-postgres');

const enabled = process.env.RUN_POSTGRES_LOAD === '1' && Boolean(process.env.DATABASE_URL);

test('10 independent candidates autosave, recover across app restart and submit exactly once', { skip: !enabled, timeout: 120_000 }, async t => {
  const pool = getPool();
  const suffix = crypto.randomUUID();
  const testId = `quiz-load-${suffix}`;
  const users = Array.from({ length: 10 }, (_, i) => `load-${suffix}-${i}`);
  let server;
  const latencies = [];
  const latencyGroups = new Map();
  const databaseGroups = new Map();
  function recordLatency(group, elapsed) {
    latencies.push(elapsed);
    if (!latencyGroups.has(group)) latencyGroups.set(group, []);
    latencyGroups.get(group).push(elapsed);
  }
  let peakRss = process.memoryUsage().rss;
  const cpuStart = process.cpuUsage();
  const sample = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 25);

  async function listen() {
    const app = createApp();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function closeServer() {
    if (!server) return;
    await new Promise(resolve => server.close(resolve));
    server = null;
  }

  try {
    await pool.query(`INSERT INTO tests(id,exam_id,exam_name,type,title,marks,questions_count,duration_minutes,marks_per_correct,negative_marks,is_free,sections_summary_json,test_data_json,created_at)
      VALUES($1,'daily-quiz','Daily Mini Quiz','daily-quiz','Synthetic load paper',2,2,60,1,.25,1,'[]',$2,$3)`, [testId,
      JSON.stringify({ id: testId, title: 'Synthetic load paper', hasSectionalTiming: true, isSectionalLocked: true, sections: [
        { title: 'Reasoning', durationSeconds: 3600, questions: [{ id: 'q1', correctIndex: 0, options: ['A', 'B'] }] },
        { title: 'Quant', durationSeconds: 3600, questions: [{ id: 'q2', correctIndex: 1, options: ['A', 'B'] }] }
      ] }), new Date().toISOString()]);

    let base = await listen();
    const sessions = await Promise.all(users.map(async (username, index) => {
      const ip = `198.51.100.${10 + index}`;
      const start = performance.now();
      const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, 'x-forwarded-for': ip },
        body: JSON.stringify({ username, name: `Synthetic ${index}`, password: `LoadCandidate-${suffix.slice(0, 8)}-${index}` }) });
      recordLatency('register', performance.now() - start);
      assert.equal(response.status, 201);
      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      const csrf = response.headers.get('x-csrf-token');
      assert.ok(cookie && csrf);
      return { cookie, csrf, username, ip, password: `LoadCandidate-${suffix.slice(0, 8)}-${index}` };
    }));

    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, 'x-forwarded-for': sessions[0].ip },
      body: JSON.stringify({ username: sessions[0].username, password: sessions[0].password }) });
    assert.equal(login.status, 200);
    sessions[0].cookie = login.headers.get('set-cookie')?.split(';')[0];
    sessions[0].csrf = login.headers.get('x-csrf-token');
    assert.ok(sessions[0].cookie && sessions[0].csrf);

    const request = async (session, url, method = 'GET', body) => {
      const start = performance.now();
      const response = await fetch(`${base}${url}`, { method, headers: { cookie: session.cookie, origin: base,
        'x-forwarded-for': session.ip,
        ...(body ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': session.csrf } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const group = url.split('?')[0].replace(/\/api\/attempts\/[^/]+$/, '/api/attempts/:id')
        .replace(/^\/api\/tests\/[^/]+$/, '/api/tests/:id');
      recordLatency(group, performance.now() - start);
      const timingHeader = response.headers.get('server-timing') || '';
      const metric = name => Number(timingHeader.match(new RegExp(`${name};dur=([0-9.]+)`))?.[1] || 0);
      const queryCount = Number(timingHeader.match(/dbq;desc="(\d+)"/)?.[1] || 0);
      if (!databaseGroups.has(group)) databaseGroups.set(group, []);
      databaseGroups.get(group).push({ db_ms: metric('db'), pool_wait_ms: metric('pool'), tx_ms: metric('tx'), json_ms: metric('json'), queries: queryCount });
      const data = await response.json();
      return { response, data };
    };

    await Promise.all(sessions.map(async session => {
      const catalog = await request(session, '/api/tests?examId=daily-quiz');
      assert.equal(catalog.response.status, 200);
      assert.ok(catalog.data.tests.some(row => row.id === testId));
      const paper = await request(session, `/api/tests/${testId}`);
      assert.equal(paper.response.status, 200);
      assert.equal(paper.data.test.sections[0].questions[0].correctIndex, undefined);
      const started = await request(session, '/api/attempts/session/start', 'POST', { testId });
      assert.equal(started.response.status, 200);
      assert.equal(started.data.timing.state, 'active');
      assert.ok(started.data.timing.remainingSeconds <= 3600 && started.data.timing.remainingSeconds > 3500);
      const secondTab = await request(session, '/api/attempts/session/start', 'POST', { testId });
      assert.equal(secondTab.data.timing.submissionKey, started.data.timing.submissionKey);
      assert.ok(secondTab.data.timing.remainingSeconds <= started.data.timing.remainingSeconds);
    }));

    await Promise.all(sessions.map((session, index) => request(session, '/api/paused-attempts', 'POST', {
      testId, revision: 2, currentSectionIndex: 0, currentQuestionIndex: 1, remainingSeconds: 3000,
      responses: { q1: { selectedIndex: index % 2 } }, bookmarkedQuestions: { q1: true }
    })));
    await Promise.all(sessions.map(session => request(session, '/api/paused-attempts', 'POST', {
      testId, revision: 1, currentSectionIndex: 0, currentQuestionIndex: 0, remainingSeconds: 3600,
      responses: { q1: { selectedIndex: 1 } }
    })));

    await closeServer(); // Emulate an instance restart; DB sessions and paused attempts must persist.
    base = await listen();
    const recovered = await Promise.all(sessions.map(session => request(session, `/api/paused-attempts?testId=${testId}`)));
    for (let index = 0; index < recovered.length; index++) {
      const { response, data } = recovered[index];
      assert.equal(response.status, 200);
      assert.equal(data.pausedAttempt.revision, 2);
      assert.equal(data.pausedAttempt.bookmarkedQuestions.q1, true);
      assert.equal(data.pausedAttempt.responses.q1.selectedIndex, index % 2);
      assert.ok(data.pausedAttempt.remainingSeconds > 0 && data.pausedAttempt.remainingSeconds <= 3600,
        'browser supplied remaining time must not extend the database deadline');
      assert.equal(data.pausedAttempt.timerState, 'active');
    }

    const pauseStart = await request(sessions[0], '/api/attempts/session/pause', 'POST', { testId,
      currentQuestionIndex: 1, responses: { q1: { selectedIndex: 0 } }, revision: 3 });
    assert.equal(pauseStart.response.status, 200);
    const frozen = pauseStart.data.timing.remainingSeconds;
    await new Promise(resolve => setTimeout(resolve, 1100));
    const pausedRead = await request(sessions[0], `/api/attempts/session?testId=${testId}`);
    assert.equal(pausedRead.data.timing.state, 'paused');
    assert.equal(pausedRead.data.timing.remainingSeconds, frozen, 'legitimate pause freezes timer');
    const resumed = await request(sessions[0], '/api/attempts/session/resume', 'POST', { testId });
    assert.equal(resumed.response.status, 200);
    assert.equal(resumed.data.timing.state, 'active');

    // A stale/tampered save after sectional expiry is rejected, then a locked forward transition succeeds.
    await pool.query('UPDATE active_test_sessions SET section_deadline_at=clock_timestamp()-INTERVAL \'2 seconds\' WHERE user_id=(SELECT id FROM users WHERE username=$1) AND test_id=$2', [sessions[1].username,testId]);
    const lateSave = await request(sessions[1], '/api/paused-attempts', 'POST', { testId, revision: 3,
      responses: { q1: { selectedIndex: 1 } }, remainingSeconds: 3600 });
    assert.equal(lateSave.response.status, 410);
    const forward = await request(sessions[1], '/api/attempts/session/section', 'POST', { testId, targetSectionIndex: 1,
      revision: 3, responses: { q1: { selectedIndex: 1 } } });
    assert.equal(forward.response.status, 200);
    assert.equal(forward.data.timing.currentSectionIndex, 1);
    assert.deepEqual(forward.data.timing.completedSections, [0]);

    // Total expiry finalizes from the latest server-saved snapshot, ignoring newly supplied late answers.
    await pool.query('UPDATE active_test_sessions SET total_deadline_at=clock_timestamp()-INTERVAL \'2 seconds\', section_deadline_at=clock_timestamp()-INTERVAL \'2 seconds\' WHERE user_id=(SELECT id FROM users WHERE username=$1) AND test_id=$2', [sessions[2].username,testId]);
    const expiredSubmit = await request(sessions[2], '/api/attempts', 'POST', { testId,
      responses: { q1: { selectedIndex: 0 }, q2: { selectedIndex: 1 } }, score: 10000 });
    assert.equal(expiredSubmit.response.status, 200);
    assert.equal(expiredSubmit.data.score, 1, 'expired test uses last saved q1 and does not accept late q2 answer');
    assert.equal(expiredSubmit.data.streakReward.coinsAwarded, 50);

    let firstCandidateDoubleClick;
    const submissions = await Promise.all(sessions.map(async (session, index) => {
      const submit = () => request(session, '/api/attempts', 'POST', {
        testId, submissionKey: `submit-${suffix}-${index}`, responses: { q1: { selectedIndex: 0 }, q2: { selectedIndex: 0 } }, score: 99999
      });
      if (index !== 0) return submit();
      firstCandidateDoubleClick = await Promise.all([submit(), submit()]);
      assert.equal(firstCandidateDoubleClick[0].data.attemptId, firstCandidateDoubleClick[1].data.attemptId);
      assert.deepEqual(firstCandidateDoubleClick.map(result => result.data.streakReward?.coinsAwarded ?? null)
        .sort((a,b) => Number(a ?? -1) - Number(b ?? -1)), [null, 50]);
      return firstCandidateDoubleClick[0];
    }));
    for (let index = 0; index < submissions.length; index++) {
      const { response, data } = submissions[index];
      assert.equal(response.status, 200);
      assert.equal(data.score, index === 2 ? 1 : .75); // Candidate 2 was expired and finalized from its earlier autosave.
      assert.equal(data.authoritative, true);
      if (index === 0 || index === 2) assert.ok([null, 50].includes(data.streakReward?.coinsAwarded ?? null));
      else assert.equal(data.streakReward?.coinsAwarded, 50);
    }
    const completedPaper = await request(sessions[0], `/api/tests/${testId}?attemptId=${submissions[0].data.attemptId}`);
    assert.equal(completedPaper.data.test.sections[0].questions[0].correctIndex, 0);
    const analytics = await request(sessions[0], '/api/analytics?userId=some-other-candidate');
    assert.equal(analytics.response.status, 200);
    assert.equal(analytics.data.stats.testsAttempted, 1);
    assert.ok(analytics.data.stats.sectionBreakdowns.length > 0);

    const duplicate = await Promise.all(sessions.map((session, index) => request(session, '/api/attempts', 'POST', {
      testId, submissionKey: `submit-${suffix}-${index}`, responses: { q1: { selectedIndex: 1 }, q2: { selectedIndex: 1 } }
    })));
    for (let i = 0; i < sessions.length; i++) {
      assert.equal(duplicate[i].data.attemptId, submissions[i].data.attemptId);
      assert.equal(duplicate[i].data.streakReward, null);
      const own = await request(sessions[i], `/api/attempts/${submissions[(i + 1) % 10].data.attemptId}`);
      assert.equal(own.response.status, 404);
    }
    const simultaneousRetry = await Promise.all([0, 1].map(() => request(sessions[0], '/api/attempts', 'POST', {
      testId, submissionKey: 'attacker-controlled-key-is-ignored', responses: { q1: { selectedIndex: 1 } }
    })));
    assert.ok(simultaneousRetry.every(result => result.response.status === 200));
    assert.equal(simultaneousRetry[0].data.attemptId, simultaneousRetry[1].data.attemptId);
    const stored = await pool.query('SELECT COUNT(*)::int AS count FROM test_attempts WHERE test_id=$1', [testId]);
    assert.equal(stored.rows[0].count, 10);
    const unauthenticated = await fetch(`${base}/api/attempts`);
    assert.equal(unauthenticated.status, 401);
    const times = [...latencies].sort((a, b) => a - b);
    const cpuUsed = process.cpuUsage(cpuStart);
    t.diagnostic(JSON.stringify({ requests: latencies.length, failures: 0, p50_ms: Math.round(times[Math.floor(times.length * .5)]),
      p95_ms: Math.round(times[Math.min(times.length - 1, Math.floor(times.length * .95))]), peak_rss_mb: Number((peakRss / 1048576).toFixed(1)),
      cpu_user_ms: Math.round(cpuUsed.user / 1000), cpu_system_ms: Math.round(cpuUsed.system / 1000),
      by_endpoint_ms: Object.fromEntries([...latencyGroups].map(([name, values]) => { const ordered = [...values].sort((a,b) => a-b); return [name,
        { count: values.length, p50: Math.round(ordered[Math.floor(ordered.length * .5)]), p95: Math.round(ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * .95))]) }]; })),
      database_by_endpoint: Object.fromEntries([...databaseGroups].map(([name, values]) => { const percentile = key => { const ordered = values.map(v => v[key]).sort((a,b)=>a-b); return { p50: Number(ordered[Math.floor(ordered.length*.5)].toFixed(1)), p95: Number(ordered[Math.min(ordered.length-1,Math.floor(ordered.length*.95))].toFixed(1)) }; }; return [name,
        { queries_p50: percentile('queries').p50, queries_p95: percentile('queries').p95, db_ms_p50: percentile('db_ms').p50, db_ms_p95: percentile('db_ms').p95,
          pool_wait_ms_p50: percentile('pool_wait_ms').p50, pool_wait_ms_p95: percentile('pool_wait_ms').p95, tx_ms_p50: percentile('tx_ms').p50, tx_ms_p95: percentile('tx_ms').p95,
          json_ms_p50: percentile('json_ms').p50, json_ms_p95: percentile('json_ms').p95 }]; })),
      pool_max: pool.options.max, pool_peak_total: pool.totalCount, candidates: 10, attempts: stored.rows[0].count }));
  } finally {
    clearInterval(sample);
    await closeServer();
    const candidates = await pool.query('SELECT id FROM users WHERE username=ANY($1::text[])', [users]).catch(() => ({ rows: [] }));
    const candidateIds = candidates.rows.map(row => row.id);
    await pool.query('DELETE FROM paused_attempts WHERE test_id=$1 OR user_id=ANY($2::text[])', [testId, candidateIds]).catch(() => {});
    await pool.query('DELETE FROM candidate_quiz_history WHERE user_id=ANY($1::text[])', [candidateIds]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id=ANY($1::text[])', [candidateIds]).catch(() => {});
    await pool.query('DELETE FROM auth_login_limits WHERE ip_hash=ANY($1::char(64)[])', [Array.from({ length: 10 }, (_, index) => digest(`198.51.100.${10 + index}`))]).catch(() => {});
    await pool.query('DELETE FROM tests WHERE id=$1', [testId]).catch(() => {});
  }
});

test.after(async () => { await closePool(); });

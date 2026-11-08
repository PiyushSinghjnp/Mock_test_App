'use strict';

require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { performance } = require('node:perf_hooks');
const { getPool, query, transaction, closePool, requestMetrics } = require('./db/postgres');
const {
  SESSION_COOKIE, digest, readCookie, createSession, loadSession, verifyCsrf, csrfTokenForSession,
  setSessionCookie, clearSessionCookie
} = require('./db/auth');
const examPatterns = require('./js/exam-patterns-2026');
const { parseQuizQuestions } = require('./lib/parse-quiz-questions');
const { getTimingConfig, timerSnapshot } = require('./lib/exam-timer');

const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const MIN_PASSWORD_LENGTH = 12;

function publicUser(row) {
  if (!row) return null;
  const { password_hash, is_admin, session_hash, csrf_hash, ...safe } = row;
  return safe;
}

function setCsrfHeader(res, token) {
  res.set('Cache-Control', 'no-store');
  res.set('X-CSRF-Token', token);
}

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const originUrl = new URL(origin);
    const requestHost = req.get('host');
    if (originUrl.host !== requestHost) {
      const requestHostname = new URL('http://' + requestHost).hostname;
      const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
      const isLocalDevProxy = process.env.NODE_ENV !== 'production'
        && originUrl.protocol === 'http:'
        && localHosts.has(originUrl.hostname)
        && originUrl.hostname === requestHostname;
      if (!isLocalDevProxy) return res.status(403).json({ success: false, error: 'Cross-origin request rejected.' });
    }
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid request origin.' });
  }
  next();
}

function requireSession(pool) {
  return async (req, res, next) => {
    const raw = readCookie(req, SESSION_COOKIE);
    if (!raw) return res.status(401).json({ success: false, error: 'Authentication required.' });
    try {
      const session = await loadSession(pool, raw);
      if (!session) return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
      req.auth = session;
      req.sessionToken = raw;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (!verifyCsrf(session, req.get('x-csrf-token'))) return res.status(403).json({ success: false, error: 'CSRF validation failed.' });
      }
      next();
    } catch {
      res.status(503).json({ success: false, error: 'Authentication service is unavailable.' });
    }
  };
}

function requireAdmin(req, res, next) {
  const expected = String(process.env.OLIVEBOARD_ADMIN_TOKEN || '');
  const supplied = String(req.get('x-admin-token') || '');
  if (!expected) return res.status(503).json({ success: false, error: 'Administrator authorization is not configured.' });
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ success: false, error: 'Administrator authorization required.' });
  }
  next();
}

function hashKey(value) { return digest(String(value || '')); }

async function authRateLimited(pool, username, ip) {
  const result = await pool.query(`
    SELECT EXISTS(SELECT 1 FROM auth_login_limits WHERE subject_hash=$1 AND ip_hash=$2 AND blocked_until > NOW())
      OR COALESCE((SELECT SUM(failures) FROM auth_login_limits WHERE ip_hash=$2 AND window_started_at > NOW()-INTERVAL '10 minutes'),0) >= 20 AS blocked
  `, [hashKey(username), hashKey(ip)]);
  return Boolean(result.rows[0]?.blocked);
}

async function recordRegistration(pool, ip) {
  await pool.query(`INSERT INTO auth_login_limits(subject_hash,ip_hash,window_started_at,failures)
    VALUES($1,$2,NOW(),1) ON CONFLICT(subject_hash,ip_hash) DO UPDATE SET
    failures=CASE WHEN auth_login_limits.window_started_at < NOW()-INTERVAL '10 minutes' THEN 1 ELSE auth_login_limits.failures+1 END,
    window_started_at=CASE WHEN auth_login_limits.window_started_at < NOW()-INTERVAL '10 minutes' THEN NOW() ELSE auth_login_limits.window_started_at END,
    blocked_until=CASE WHEN auth_login_limits.window_started_at < NOW()-INTERVAL '10 minutes' THEN NULL
      WHEN auth_login_limits.failures >= 19 THEN NOW()+INTERVAL '15 minutes' ELSE auth_login_limits.blocked_until END`,
  [hashKey('registration'), hashKey(ip)]);
}

async function recordAuthFailure(pool, username, ip) {
  await pool.query(`
    INSERT INTO auth_login_limits(subject_hash, ip_hash, window_started_at, failures)
    VALUES($1, $2, NOW(), 1)
    ON CONFLICT(subject_hash, ip_hash) DO UPDATE SET
      failures = CASE WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '10 minutes' THEN 1 ELSE auth_login_limits.failures + 1 END,
      window_started_at = CASE WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '10 minutes' THEN NOW() ELSE auth_login_limits.window_started_at END,
      blocked_until = CASE WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '10 minutes' THEN NULL
        WHEN auth_login_limits.failures >= 7 THEN NOW() + INTERVAL '15 minutes' ELSE auth_login_limits.blocked_until END
  `, [hashKey(username), hashKey(ip)]);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(hash).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hash || '')) return false;
  const candidate = Buffer.from(await scrypt(password, salt, 64));
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

function scrubSolutions(value) {
  if (Array.isArray(value)) return value.map(scrubSolutions);
  if (!value || typeof value !== 'object') return value;
  const hidden = new Set(['correctAnswer', 'correctIndex', 'correct_answer', 'correct_index', 'explanation', 'explanationHTML', 'explanation_html', 'solution']);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !hidden.has(key)).map(([key, item]) => [key, scrubSolutions(item)]));
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function pickIndex(value) {
  const raw = value && typeof value === 'object' ? (value.selectedIndex ?? value.answerIndex) : value;
  if (Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if (/^[A-E]$/.test(upper)) return upper.charCodeAt(0) - 65;
    if (/^\d+$/.test(upper)) return Number(upper);
  }
  return null;
}

function scorePaper(testRow, submitted) {
  const paper = parseJson(testRow.test_data_json, {});
  const responses = submitted && typeof submitted === 'object' && !Array.isArray(submitted) ? submitted : {};
  const questions = [];
  for (const section of paper.sections || []) {
    for (const q of section.questions || []) questions.push({ ...q, section: q.section || section.title || 'General', sectionMeta: section });
  }
  const counts = { correct: 0, wrong: 0, unanswered: 0 };
  const breakdown = new Map();
  const normalized = {};
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const name = q.section;
    const positive = Number(q.marksForCorrect ?? q.sectionMeta.positiveMarks ?? testRow.marks_per_correct ?? 1);
    const negative = Number(q.negativeMarks ?? q.sectionMeta.negativeMarks ?? testRow.negative_marks ?? 0.25);
    maxScore += positive;
    if (!breakdown.has(name)) breakdown.set(name, { sectionName: name, correct: 0, wrong: 0, unanswered: 0, score: 0, maxMarks: 0, total: 0 });
    const section = breakdown.get(name);
    section.total++;
    section.maxMarks += positive;
    const selected = pickIndex(responses[q.id] ?? responses[String(q.questionNumber)]);
    const options = Array.isArray(q.options) ? q.options : [];
    if (selected === null) {
      counts.unanswered++;
      section.unanswered++;
      normalized[q.id] = { selectedIndex: null, status: 'stic-notvisited', timeSpentSeconds: 0 };
      continue;
    }
    if (selected >= options.length) throw new Error('Submitted option index is outside the trusted question options.');
    const expected = Number.isInteger(q.correctIndex)
      ? q.correctIndex
      : (/^[A-E]$/i.test(String(q.correctAnswer || '')) ? String(q.correctAnswer).toUpperCase().charCodeAt(0) - 65 : Number(q.correctAnswer));
    if (!Number.isInteger(expected) || expected < 0 || expected >= options.length) throw new Error('Trusted test answer data is invalid.');
    normalized[q.id] = { selectedIndex: selected, status: 'stic-answered', timeSpentSeconds: Math.max(0, Math.min(86400, Number(responses[q.id]?.timeSpentSeconds) || 0)) };
    if (selected === expected) {
      counts.correct++;
      section.correct++;
      section.score += positive;
      score += positive;
    } else {
      counts.wrong++;
      section.wrong++;
      section.score -= negative;
      score -= negative;
    }
  }
  const attempted = counts.correct + counts.wrong;
  const accuracy = attempted ? Number((counts.correct / attempted * 100).toFixed(1)) : 0;
  const sectionBreakdown = [...breakdown.values()].map(section => ({
    ...section,
    score: Number(section.score.toFixed(2)),
    accuracy: section.correct + section.wrong ? Number((section.correct / (section.correct + section.wrong) * 100).toFixed(1)) : 0
  }));
  return { paper, questions, counts, score: Number(score.toFixed(2)), maxScore: Number(testRow.marks || maxScore), accuracy, sectionBreakdown, normalizedResponses: normalized };
}

const TIMER_SELECT = `SELECT s.*,clock_timestamp() AS evaluated_at FROM active_test_sessions s`;

async function selectTimer(client, userId, testId, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const result = await client.query(`${TIMER_SELECT} WHERE s.user_id=$1 AND s.test_id=$2${suffix}`, [userId, testId]);
  const row = result.rows[0];
  return row ? { row, timing: timerSnapshot(row, row.evaluated_at) } : { row: null, timing: null };
}

function timerResponse(row, timing) {
  return { state: timing.state, remainingSeconds: timing.remainingSeconds,
    sectionRemainingSeconds: timing.sectionRemainingSeconds, currentSectionIndex: timing.currentSectionIndex,
    completedSections: timing.completedSections, revision: timing.revision, startedAt: timing.startedAt,
    totalExpired: timing.totalExpired, sectionExpired: timing.sectionExpired,
    submissionKey: row.submission_key, serverTime: row.evaluated_at };
}

function boundedLegacySeconds(value, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.floor(n)) : fallback;
}

async function savePausedSnapshot(client, userId, testId, body, timing) {
  const suppliedRevision = Number(body?.revision);
  const revision = Number.isSafeInteger(suppliedRevision) && suppliedRevision > 0 ? suppliedRevision : 1;
  const result = await client.query(`INSERT INTO paused_attempts(user_id,test_id,current_section_index,current_question_index,last_question_number,
    section_remaining_seconds,remaining_seconds,completed_sections_json,responses_json,bookmarked_json,updated_at,revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()::text,$11)
    ON CONFLICT(user_id,test_id) DO UPDATE SET current_section_index=EXCLUDED.current_section_index,
      current_question_index=EXCLUDED.current_question_index,last_question_number=EXCLUDED.last_question_number,
      section_remaining_seconds=EXCLUDED.section_remaining_seconds,remaining_seconds=EXCLUDED.remaining_seconds,
      completed_sections_json=EXCLUDED.completed_sections_json,responses_json=EXCLUDED.responses_json,
      bookmarked_json=EXCLUDED.bookmarked_json,updated_at=EXCLUDED.updated_at,revision=EXCLUDED.revision
    WHERE paused_attempts.revision < EXCLUDED.revision RETURNING revision`, [userId,testId,timing.currentSectionIndex,
    Math.max(0,Number(body?.currentQuestionIndex)||0),Math.max(1,Number(body?.lastQuestionNumber)||1),timing.sectionRemainingSeconds,
    timing.remainingSeconds,JSON.stringify(timing.completedSections),JSON.stringify(body?.responses && typeof body.responses==='object' ? body.responses : {}),
    JSON.stringify(body?.bookmarkedQuestions && typeof body.bookmarkedQuestions==='object' ? body.bookmarkedQuestions : {}),revision]);
  return { saved: Boolean(result.rowCount), revision: Number(result.rows[0]?.revision) || revision };
}

function createApp() {
  if (process.env.NODE_ENV === 'production') {
    for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'OLIVEBOARD_ADMIN_TOKEN']) {
      if (!process.env[key] || process.env[key].length < (key === 'DATABASE_URL' ? 1 : 32)) throw new Error(`${key} must be configured in production.`);
    }
    let databaseHost;
    try { databaseHost = new URL(process.env.DATABASE_URL).hostname; } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL.'); }
    if (!databaseHost.includes('-pooler')) throw new Error('Production DATABASE_URL must use the Neon pooled endpoint.');
  }
  const app = express();
  const pool = getPool();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use((req, res, next) => {
    const metrics = { queryCount: 0, queryMs: 0, poolWaitMs: 0, transactionMs: 0, jsonMs: 0 };
    const originalEnd = res.end;
    const originalJson = res.json;
    res.json = function (body) {
      const started = performance.now();
      const originalSend = this.send;
      this.send = function (...args) {
        metrics.jsonMs += performance.now() - started;
        this.send = originalSend;
        return originalSend.apply(this, args);
      };
      return originalJson.call(this, body);
    };
    res.end = function (...args) {
      if (!this.headersSent) this.setHeader('Server-Timing', `db;dur=${metrics.queryMs.toFixed(1)}, dbq;desc="${metrics.queryCount}", pool;dur=${metrics.poolWaitMs.toFixed(1)}, tx;dur=${metrics.transactionMs.toFixed(1)}, json;dur=${metrics.jsonMs.toFixed(1)}`);
      return originalEnd.apply(this, args);
    };
    requestMetrics.run(metrics, next);
  });

  // Liveness only: Render's periodic health probes must not wake Neon or keep
  // its free compute active. Use /ready for an explicit database check.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });

  for (const directory of ['assets', 'css', 'images', 'img', 'oliveimg', 'lib', 'js', 'data', 'scraped', 'scraped_specs', 'papers']) {
    app.use(`/${directory}`, express.static(path.join(DIST, directory), { dotfiles: 'deny', index: false, fallthrough: true }));
  }
  app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(DIST, 'admin.html')));

  const auth = requireSession(pool);

  app.post('/api/auth/login', sameOrigin, async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!username || typeof password !== 'string') return res.status(400).json({ success: false, error: 'Username and password are required.' });
    if (await authRateLimited(pool, username, req.ip)) return res.status(429).json({ success: false, error: 'Too many sign-in attempts. Try again later.' });
    const result = await pool.query('SELECT * FROM users WHERE LOWER(username)=$1', [username]);
    const user = result.rows[0];
    const valid = user && !(process.env.NODE_ENV === 'production' && password === 'password123') && await verifyPassword(password, user.password_hash);
    if (!valid) {
      await recordAuthFailure(pool, username, req.ip);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    await pool.query('DELETE FROM auth_login_limits WHERE subject_hash=$1 AND ip_hash=$2', [hashKey(username), hashKey(req.ip)]);
    const session = await transaction(client => createSession(client, user.id));
    setSessionCookie(res, session.token);
    setCsrfHeader(res, session.csrfToken);
    res.json({ success: true, message: 'Login successful', csrfToken: session.csrfToken, user: publicUser(user) });
  });

  app.post('/api/auth/register', sameOrigin, async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const password = req.body?.password;
    const name = String(req.body?.name || '').trim();
    if (!username || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ success: false, error: `Username and password (minimum ${MIN_PASSWORD_LENGTH} characters) are required.` });
    if (await authRateLimited(pool, 'registration', req.ip) || await authRateLimited(pool, username, req.ip)) return res.status(429).json({ success: false, error: 'Too many account requests. Try again later.' });
    const id = `user-${crypto.randomUUID()}`;
    const displayName = name || username;
    const createdAt = new Date().toISOString();
    try {
      const user = await transaction(async client => {
        const inserted = await client.query(`
          INSERT INTO users(id,username,name,email,avatar,roll_no,target_exam,password_hash,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id,username,name,email,avatar,roll_no,target_exam,coins,streak_days,last_quiz_date,created_at,is_admin
        `, [id, username, displayName, `${username}@oliveboard.test`, displayName[0].toUpperCase(), `OB-${crypto.randomInt(100000, 999999)}`, req.body?.target_exam || 'sbi-po', await hashPassword(password), createdAt]);
        return inserted.rows[0];
      });
      await pool.query('DELETE FROM auth_login_limits WHERE subject_hash=$1 AND ip_hash=$2', [hashKey(username), hashKey(req.ip)]);
      await recordRegistration(pool, req.ip);
      const session = await transaction(client => createSession(client, user.id));
      setSessionCookie(res, session.token);
      setCsrfHeader(res, session.csrfToken);
      res.status(201).json({ success: true, message: 'Account created successfully', csrfToken: session.csrfToken, user: publicUser(user) });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, error: 'Username already taken. Please choose another or sign in.' });
      throw error;
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const raw = readCookie(req, SESSION_COOKIE);
    if (!raw) return res.json({ success: true, authenticated: false, user: null });
    const session = await loadSession(pool, raw);
    if (!session) return res.json({ success: true, authenticated: false, user: null });
    const csrfToken = csrfTokenForSession(raw);
    const csrfHash = digest(csrfToken);
    await pool.query('UPDATE auth_sessions SET csrf_hash=$1,last_seen_at=NOW() WHERE session_hash=$2 AND csrf_hash<>$1', [csrfHash, session.session_hash]);
    setCsrfHeader(res, csrfToken);
    res.json({ success: true, authenticated: true, csrfToken, user: publicUser(session) });
  });

  app.post('/api/auth/logout', auth, async (req, res) => {
    await pool.query('DELETE FROM auth_sessions WHERE session_hash=$1', [digest(req.sessionToken)]);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.get('/api/users', auth, async (req, res) => {
    const result = await pool.query(`SELECT u.id,u.username,u.name,u.email,u.avatar,u.roll_no,u.target_exam,u.created_at,u.coins,u.streak_days,u.last_quiz_date,
      (SELECT COUNT(*) FROM test_attempts a WHERE a.user_id=u.id)::int AS attempts_count FROM users u WHERE u.id=$1`, [req.auth.user_id]);
    res.json({ success: true, users: result.rows });
  });

  app.post('/api/users', auth, sameOrigin, (_req, res) => res.status(403).json({ success: false, error: 'Use account registration to create a separately credentialed candidate.' }));

  app.patch('/api/users/:id', auth, sameOrigin, async (req, res) => {
    if (req.params.id !== req.auth.user_id) return res.status(403).json({ success: false, error: 'Candidate access denied.' });
    const { name, target_exam, roll_no } = req.body || {};
    const updated = await pool.query(`UPDATE users SET name=COALESCE(NULLIF($1,''),name), target_exam=COALESCE(NULLIF($2,''),target_exam), roll_no=COALESCE(NULLIF($3,''),roll_no)
      WHERE id=$4 RETURNING id,username,name,email,avatar,roll_no,target_exam,coins,streak_days,last_quiz_date,created_at`, [String(name || '').trim(), String(target_exam || ''), String(roll_no || ''), req.auth.user_id]);
    res.json({ success: true, user: updated.rows[0] });
  });

  app.get('/api/tests', async (req, res) => {
    const requestedExamId = req.query.examId || req.query.exam || null;
    const rawToken = readCookie(req, SESSION_COOKIE);
    const userId = rawToken ? (await loadSession(pool, rawToken))?.user_id || null : null;
    const result = await pool.query(`SELECT t.id,t.exam_id,t.exam_name,t.type,t.title,t.subtitle,t.marks,t.questions_count,t.duration_minutes,
      t.marks_per_correct,t.negative_marks,t.is_free,t.sections_summary_json,
      a.id AS attempt_id,a.score AS attempt_score,a.max_score AS attempt_max_score,a.accuracy AS attempt_accuracy,
      a.percentile AS attempt_percentile,a.estimated_air AS attempt_estimated_air,a.completed_at AS attempt_completed_at,
      p.current_section_index,p.current_question_index,p.last_question_number,p.section_remaining_seconds,p.remaining_seconds,
      p.completed_sections_json,p.responses_json,p.bookmarked_json,p.revision
      FROM tests t
      LEFT JOIN LATERAL (SELECT id,score,max_score,accuracy,percentile,estimated_air,completed_at FROM test_attempts
        WHERE user_id=$2 AND test_id=t.id ORDER BY completed_at DESC LIMIT 1) a ON TRUE
      LEFT JOIN paused_attempts p ON p.user_id=$2 AND p.test_id=t.id
      WHERE ($1::text IS NULL OR $1='all' OR t.exam_id=$1) ORDER BY t.is_free DESC,t.id`, [requestedExamId, userId]);
    const tests = result.rows.map(row => ({
      id: row.id, examId: row.exam_id, examName: row.exam_name, type: row.type, title: row.title,
      subtitle: row.subtitle, marks: Number(row.marks), questionsCount: row.questions_count,
      durationMinutes: row.duration_minutes, marksPerCorrect: Number(row.marks_per_correct),
      negativeMarks: Number(row.negative_marks), isFree: Boolean(row.is_free),
      sectionsSummary: parseJson(row.sections_summary_json, []),
      userAttempt: row.attempt_id ? { attempt_id: row.attempt_id, test_id: row.id, score: row.attempt_score, max_score: row.attempt_max_score,
        accuracy: row.attempt_accuracy, percentile: row.attempt_percentile, estimated_air: row.attempt_estimated_air, completed_at: row.attempt_completed_at } : null,
      isAttempted: Boolean(row.attempt_id),
      pausedAttempt: row.revision !== null ? { currentSectionIndex: row.current_section_index, currentQuestionIndex: row.current_question_index,
        lastQuestionNumber: row.last_question_number, sectionRemainingSeconds: row.section_remaining_seconds, remainingSeconds: row.remaining_seconds,
        completedSections: parseJson(row.completed_sections_json, []), responses: parseJson(row.responses_json, {}),
        bookmarkedQuestions: parseJson(row.bookmarked_json, {}), revision: Number(row.revision) } : null,
      isPaused: row.revision !== null
    }));
    res.json({ success: true, count: tests.length, tests });
  });

  app.get('/api/tests/:id', auth, async (req, res) => {
    const result = await pool.query('SELECT * FROM tests WHERE LOWER(id)=LOWER($1)', [req.params.id]);
    const test = result.rows[0];
    if (!test) return res.status(404).json({ success: false, error: 'Test not found.' });
    const attemptId = req.query.attemptId;
    let completed = false;
    if (attemptId) completed = (await pool.query('SELECT 1 FROM test_attempts WHERE id=$1 AND user_id=$2 AND test_id=$3', [attemptId, req.auth.user_id, test.id])).rowCount > 0;
    const paper = parseJson(test.test_data_json, {});
    res.json({ success: true, test: completed ? paper : scrubSolutions(paper) });
  });

  app.post('/api/attempts/session/start', auth, sameOrigin, async (req, res) => {
    const testId = String(req.body?.testId || '');
    if (!testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    const result = await transaction(async client => {
      // Test papers are immutable during an attempt; a shared lock allows all
      // candidates starting the same exam to initialize concurrently.
      const testResult = await client.query('SELECT * FROM tests WHERE id=$1 FOR SHARE', [testId]);
      const test = testResult.rows[0];
      if (!test) return { status: 404, error: 'Test not found.' };
      const config = getTimingConfig(test);
      let { row, timing } = await selectTimer(client, req.auth.user_id, testId, true);
      if (row?.state === 'active') {
        if (timing.remainingSeconds <= 0) {
          await client.query("UPDATE active_test_sessions SET state='expired',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id, testId]);
          return { status: 410, error: 'This test has expired.' };
        }
        return { row, timing };
      }
      if (row?.state === 'expired') return { status: 410, error: 'This test has expired.' };
      if (row?.state === 'paused') {
        if (timing.remainingSeconds <= 0 || timing.sectionRemainingSeconds <= 0) {
          await client.query("UPDATE active_test_sessions SET state='expired',updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id, testId]);
          return { status: 410, error: 'This test has expired.' };
        }
        await client.query(`UPDATE active_test_sessions SET state='active',
          total_deadline_at=clock_timestamp()+($3 * INTERVAL '1 second'),
          section_deadline_at=clock_timestamp()+($4 * INTERVAL '1 second'),updated_at=NOW()
          WHERE user_id=$1 AND test_id=$2`, [req.auth.user_id, testId, timing.remainingSeconds, timing.sectionRemainingSeconds]);
        return selectTimer(client, req.auth.user_id, testId);
      }

      let sectionIndex = 0, completedSections = [], remaining = config.durationSeconds;
      const legacy = await client.query('SELECT current_section_index,completed_sections_json,remaining_seconds,section_remaining_seconds FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id, testId]);
      if (legacy.rowCount) {
        const saved = legacy.rows[0];
        sectionIndex = Math.max(0, Math.min(config.sectionDurations.length - 1, Number(saved.current_section_index) || 0));
        completedSections = parseJson(saved.completed_sections_json, []).filter(index => Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < config.sectionDurations.length);
        remaining = boundedLegacySeconds(saved.remaining_seconds, config.durationSeconds, config.durationSeconds);
      }
      const sectionMax = config.hasSectionalTiming ? (config.sectionDurations[sectionIndex] || config.durationSeconds) : config.durationSeconds;
      const sectionRemaining = legacy.rowCount
        ? boundedLegacySeconds(legacy.rows[0].section_remaining_seconds, sectionMax, sectionMax)
        : sectionMax;
      const submissionKey = crypto.randomUUID();
      if (row?.state === 'submitted') {
        await client.query(`UPDATE active_test_sessions SET state='active',started_at=clock_timestamp(),
          total_deadline_at=clock_timestamp()+($3 * INTERVAL '1 second'),section_deadline_at=clock_timestamp()+($4 * INTERVAL '1 second'),
          remaining_seconds=$3,section_remaining_seconds=$4,current_section_index=$5,completed_sections_json=$6,
          revision=revision+1,submission_key=$7,updated_at=NOW()
          WHERE user_id=$1 AND test_id=$2`, [req.auth.user_id,testId,remaining,sectionRemaining,sectionIndex,JSON.stringify(completedSections),submissionKey]);
      } else {
        await client.query(`INSERT INTO active_test_sessions(user_id,test_id,state,started_at,total_deadline_at,section_deadline_at,
          remaining_seconds,section_remaining_seconds,current_section_index,completed_sections_json,submission_key)
          VALUES($1,$2,'active',clock_timestamp(),clock_timestamp()+($3 * INTERVAL '1 second'),
          clock_timestamp()+($4 * INTERVAL '1 second'),$3,$4,$5,$6,$7)`,
        [req.auth.user_id,testId,remaining,sectionRemaining,sectionIndex,JSON.stringify(completedSections),submissionKey]);
      }
      return selectTimer(client, req.auth.user_id, testId);
    });
    if (result.status) return res.status(result.status).json({ success: false, error: result.error });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, timing: timerResponse(result.row, result.timing) });
  });

  app.get('/api/attempts/session', auth, async (req, res) => {
    const testId = String(req.query.testId || '');
    if (!testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    const result = await selectTimer(pool, req.auth.user_id, testId);
    if (!result.row) return res.json({ success: true, timing: null });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, timing: timerResponse(result.row, result.timing) });
  });

  app.post('/api/attempts/session/pause', auth, sameOrigin, async (req, res) => {
    const testId = String(req.body?.testId || '');
    if (!testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    const result = await transaction(async client => {
      const selected = await selectTimer(client, req.auth.user_id, testId, true);
      if (!selected.row) return { status: 404, error: 'Active test session not found.' };
      if (selected.timing.state === 'expired') {
        await client.query("UPDATE active_test_sessions SET state='expired',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id,testId]);
        return { status: 410, error: 'This test has expired.' };
      }
      if (selected.row.state === 'active') {
        if (selected.timing.sectionRemainingSeconds <= 0) return { status: 410, error: 'The current section has expired.', timing: selected.timing };
        const saved = await savePausedSnapshot(client, req.auth.user_id, testId, req.body || {}, selected.timing);
        await client.query(`UPDATE active_test_sessions SET state='paused',total_deadline_at=NULL,section_deadline_at=NULL,
          remaining_seconds=$3,section_remaining_seconds=$4,updated_at=NOW()
          WHERE user_id=$1 AND test_id=$2`, [req.auth.user_id,testId,selected.timing.remainingSeconds,selected.timing.sectionRemainingSeconds]);
        selected.save = saved;
      }
      return selectTimer(client, req.auth.user_id, testId);
    });
    if (result.status) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, timing: timerResponse(result.row, result.timing) });
  });

  app.post('/api/attempts/session/resume', auth, sameOrigin, async (req, res) => {
    const testId = String(req.body?.testId || '');
    if (!testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    const result = await transaction(async client => {
      const selected = await selectTimer(client, req.auth.user_id, testId, true);
      if (!selected.row) return { status: 404, error: 'Test session not found.' };
      if (selected.row.state === 'expired' || selected.timing.remainingSeconds <= 0 || selected.timing.sectionRemainingSeconds <= 0) {
        await client.query("UPDATE active_test_sessions SET state='expired',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id,testId]);
        return { status: 410, error: 'This test has expired.' };
      }
      if (selected.row.state === 'submitted') return { status: 409, error: 'This test has already been submitted.' };
      if (selected.row.state === 'paused') {
        await client.query(`UPDATE active_test_sessions SET state='active',
          total_deadline_at=clock_timestamp()+($3 * INTERVAL '1 second'),section_deadline_at=clock_timestamp()+($4 * INTERVAL '1 second'),updated_at=NOW()
          WHERE user_id=$1 AND test_id=$2`, [req.auth.user_id,testId,selected.timing.remainingSeconds,selected.timing.sectionRemainingSeconds]);
      }
      return selectTimer(client, req.auth.user_id, testId);
    });
    if (result.status) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, timing: timerResponse(result.row, result.timing) });
  });

  app.post('/api/attempts/session/section', auth, sameOrigin, async (req, res) => {
    const testId = String(req.body?.testId || '');
    const targetIndex = Number(req.body?.targetSectionIndex);
    if (!testId || !Number.isInteger(targetIndex)) return res.status(400).json({ success: false, error: 'testId and targetSectionIndex are required.' });
    const result = await transaction(async client => {
      const testResult = await client.query('SELECT * FROM tests WHERE id=$1 FOR SHARE', [testId]);
      const test = testResult.rows[0];
      if (!test) return { status: 404, error: 'Test not found.' };
      const config = getTimingConfig(test);
      const selected = await selectTimer(client, req.auth.user_id, testId, true);
      if (!selected.row || selected.row.state !== 'active') return { status: 409, error: 'Test session is not active.' };
      const currentIndex = selected.timing.currentSectionIndex;
      if (selected.timing.remainingSeconds <= 0) {
        await client.query("UPDATE active_test_sessions SET state='expired',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id,testId]);
        return { status: 410, error: 'Test time has expired.', timing: selected.timing };
      }
      if (targetIndex < 0 || targetIndex >= config.sectionDurations.length) return { status: 400, error: 'Invalid section index.' };
      if (targetIndex === currentIndex) return selected;
      if (config.isSectionalLocked && targetIndex !== currentIndex + 1) return { status: 403, error: 'Section navigation is locked.' };
      if (selected.timing.sectionRemainingSeconds > 0 && targetIndex < currentIndex) return { status: 403, error: 'Completed sections cannot be reopened.' };
      const completed = new Set(selected.timing.completedSections.map(Number));
      if (config.isSectionalLocked) completed.add(currentIndex);
      if (selected.timing.sectionRemainingSeconds > 0) await savePausedSnapshot(client, req.auth.user_id, testId, req.body || {}, selected.timing);
      const newSectionRemaining = config.hasSectionalTiming ? Math.min(config.sectionDurations[targetIndex], selected.timing.remainingSeconds) : selected.timing.remainingSeconds;
      await client.query(`UPDATE active_test_sessions SET current_section_index=$3,completed_sections_json=$4,
        section_remaining_seconds=$5::integer,section_deadline_at=CASE WHEN $6::boolean THEN clock_timestamp()+($5::integer * INTERVAL '1 second') ELSE total_deadline_at END,
        revision=revision+1,updated_at=NOW() WHERE user_id=$1 AND test_id=$2`,
      [req.auth.user_id,testId,targetIndex,JSON.stringify([...completed]),newSectionRemaining,config.hasSectionalTiming]);
      return selectTimer(client, req.auth.user_id, testId);
    });
    if (result.status) return res.status(result.status).json({ success: false, error: result.error, timing: result.timing || null });
    res.json({ success: true, timing: timerResponse(result.row, result.timing) });
  });

  app.post('/api/paused-attempts', auth, sameOrigin, async (req, res) => {
    const body = req.body || {};
    if (!body.testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    const revision = Number.isSafeInteger(body.revision) && body.revision > 0 ? body.revision : 1;
    const result = await transaction(async client => {
      const selected = await selectTimer(client, req.auth.user_id, body.testId, true);
      if (!selected.row) return { status: 409, error: 'Start the test before saving answers.' };
      if (selected.timing.state === 'expired') {
        await client.query("UPDATE active_test_sessions SET state='expired',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id,body.testId]);
        return { status: 410, error: 'The current exam timer has expired.', timing: selected.timing };
      }
      if (selected.row.state === 'active' && selected.timing.sectionRemainingSeconds <= 0) {
        return { status: 410, error: 'The current exam section has expired.', timing: selected.timing };
      }
      if (!['active','paused'].includes(selected.row.state)) return { status: 409, error: 'Test session is not writable.' };
      const saved = await client.query(`INSERT INTO paused_attempts(user_id,test_id,current_section_index,current_question_index,last_question_number,
        section_remaining_seconds,remaining_seconds,completed_sections_json,responses_json,bookmarked_json,updated_at,revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()::text,$11)
        ON CONFLICT(user_id,test_id) DO UPDATE SET current_section_index=EXCLUDED.current_section_index,
          current_question_index=EXCLUDED.current_question_index,last_question_number=EXCLUDED.last_question_number,
          section_remaining_seconds=EXCLUDED.section_remaining_seconds,remaining_seconds=EXCLUDED.remaining_seconds,
          completed_sections_json=EXCLUDED.completed_sections_json,responses_json=EXCLUDED.responses_json,
          bookmarked_json=EXCLUDED.bookmarked_json,updated_at=EXCLUDED.updated_at,revision=EXCLUDED.revision
        WHERE paused_attempts.revision < EXCLUDED.revision RETURNING revision`, [req.auth.user_id,body.testId,
        selected.timing.currentSectionIndex, Math.max(0,Number(body.currentQuestionIndex)||0), Number(body.lastQuestionNumber)||1,
        selected.timing.sectionRemainingSeconds, selected.timing.remainingSeconds, JSON.stringify(selected.timing.completedSections),
        JSON.stringify(body.responses && typeof body.responses === 'object' ? body.responses : {}),
        JSON.stringify(body.bookmarkedQuestions && typeof body.bookmarkedQuestions === 'object' ? body.bookmarkedQuestions : {}), revision]);
      const currentResult = saved.rowCount ? saved : await client.query(
        'SELECT revision FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id,body.testId]);
      const current = currentResult.rows[0]?.revision;
      const timing = saved.rowCount ? (await selectTimer(client,req.auth.user_id,body.testId)).timing : selected.timing;
      return { saved: Boolean(saved.rowCount), revision: Number(current) || revision, timing };
    });
    if (result.status) return res.status(result.status).json({ success: false, error: result.error, timing: result.timing || null });
    res.json({ success: true, ...result });
  });

  app.get('/api/paused-attempts', auth, async (req, res) => {
    const { testId } = req.query;
    if (testId) {
      const result = await pool.query('SELECT * FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id, testId]);
      const row = result.rows[0];
      const session = await selectTimer(pool, req.auth.user_id, testId);
      const timing = session.timing;
      const pausedAttempt = row || timing ? {
        currentSectionIndex: timing?.currentSectionIndex ?? row.current_section_index,
        currentQuestionIndex: row?.current_question_index ?? 0,
        lastQuestionNumber: row?.last_question_number ?? 1,
        sectionRemainingSeconds: timing?.sectionRemainingSeconds ?? row.section_remaining_seconds,
        remainingSeconds: timing?.remainingSeconds ?? row.remaining_seconds,
        completedSections: timing?.completedSections ?? parseJson(row.completed_sections_json, []),
        responses: parseJson(row?.responses_json, {}), bookmarkedQuestions: parseJson(row?.bookmarked_json, {}),
        revision: Number(row?.revision) || 0, updatedAt: row?.updated_at || session.row.started_at,
        timerState: timing?.state || null, serverTime: session.row?.evaluated_at || null
      } : null;
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, pausedAttempt });
    }
    const rows = await pool.query('SELECT * FROM paused_attempts WHERE user_id=$1 ORDER BY updated_at DESC', [req.auth.user_id]);
    res.json({ success: true, pausedAttempts: rows.rows });
  });

  app.delete('/api/paused-attempts', auth, sameOrigin, async (req, res) => {
    if (!req.query.testId) return res.status(400).json({ success: false, error: 'testId is required.' });
    await pool.query('DELETE FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id, req.query.testId]);
    res.json({ success: true });
  });

  app.post('/api/attempts', auth, sameOrigin, async (req, res) => {
    const { testId, responses = {}, timeSpentSeconds = 0 } = req.body || {};
    if (!testId || !responses || typeof responses !== 'object' || Array.isArray(responses)) return res.status(400).json({ success: false, error: 'A valid testId and responses map are required.' });
    const saved = await transaction(async client => {
      const testResult = await client.query('SELECT * FROM tests WHERE id=$1 FOR SHARE', [testId]);
      const test = testResult.rows[0];
      if (!test) throw Object.assign(new Error('Test not found.'), { status: 404 });
      const timer = await selectTimer(client, req.auth.user_id, testId, true);
      if (!timer.row) throw Object.assign(new Error('Start the test before submitting.'), { status: 409 });
      const submissionKey = timer.row.submission_key;
      const duplicate = await client.query('SELECT id,score,max_score,correct_count,wrong_count,unanswered_count,accuracy,percentile,estimated_air,time_spent_seconds,section_breakdown_json,responses_json FROM test_attempts WHERE user_id=$1 AND submission_key=$2', [req.auth.user_id, submissionKey]);
      if (duplicate.rowCount) return { ...duplicate.rows[0], streakReward: null };
      if (timer.row.state === 'submitted') throw Object.assign(new Error('This test has already been submitted.'), { status: 409 });
      const timingConfig = getTimingConfig(test);
      const expired = timer.row.state === 'expired' || timer.timing.state === 'expired' || timer.timing.remainingSeconds <= 0 ||
        (timingConfig.hasSectionalTiming && timer.timing.sectionRemainingSeconds <= 0);
      const savedPaused = expired ? await client.query('SELECT responses_json FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id,testId]) : null;
      const trustedResponses = expired ? parseJson(savedPaused?.rows[0]?.responses_json, {}) : responses;
      let scored;
      try { scored = scorePaper(test, trustedResponses); }
      catch (error) { throw Object.assign(error, { status: 400 }); }
      const correct = scored.counts.correct, wrong = scored.counts.wrong, unanswered = scored.counts.unanswered;
      const rank = examPatterns.calculateTestRankAndPercentile({ testId, testTitle: test.title, testType: test.type,
        score: scored.score, maxScore: scored.maxScore, correctCount: correct, wrongCount: wrong,
        unansweredCount: unanswered, totalQuestions: scored.questions.length, accuracy: scored.accuracy });
      const attemptId = `att-${crypto.randomUUID()}`;
      const elapsedSeconds = Math.max(0, getTimingConfig(test).durationSeconds - timer.timing.remainingSeconds);
      const now = new Date().toISOString();
      const inserted = await client.query(`WITH inserted AS (INSERT INTO test_attempts(
        id,user_id,test_id,test_title,total_questions,score,max_score,correct_count,wrong_count,unanswered_count,
        accuracy,percentile,estimated_air,time_spent_seconds,section_breakdown_json,responses_json,started_at,completed_at,submission_key
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT(user_id,submission_key) WHERE submission_key IS NOT NULL DO NOTHING
      RETURNING id,score,max_score,correct_count,wrong_count,unanswered_count,accuracy,percentile,estimated_air,time_spent_seconds,section_breakdown_json,responses_json),
      cleanup AS (DELETE FROM paused_attempts WHERE user_id=$2 AND test_id=$3 AND EXISTS(SELECT 1 FROM inserted) RETURNING user_id)
      SELECT * FROM inserted`, [
        attemptId, req.auth.user_id, testId, test.title, scored.questions.length, scored.score, scored.maxScore,
        correct, wrong, unanswered, scored.accuracy, rank.percentile, rank.estimatedAIR,
        Math.max(0, Math.min(86400, elapsedSeconds)), JSON.stringify(scored.sectionBreakdown),
        JSON.stringify(scored.normalizedResponses), now, now, submissionKey
      ]);
      if (!inserted.rowCount) {
        const duplicate = await client.query('SELECT id,score,max_score,correct_count,wrong_count,unanswered_count,accuracy,percentile,estimated_air,time_spent_seconds,section_breakdown_json,responses_json FROM test_attempts WHERE user_id=$1 AND submission_key=$2', [req.auth.user_id, submissionKey]);
        return { ...duplicate.rows[0], streakReward: null };
      }
      await client.query("UPDATE active_test_sessions SET state='submitted',total_deadline_at=NULL,section_deadline_at=NULL,updated_at=NOW() WHERE user_id=$1 AND test_id=$2", [req.auth.user_id,testId]);
      await client.query('DELETE FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [req.auth.user_id,testId]);
      let streakReward = null;
      if (String(testId).startsWith('quiz-')) {
        const user = (await client.query('SELECT coins,streak_days,last_quiz_date FROM users WHERE id=$1 FOR UPDATE', [req.auth.user_id])).rows[0];
        if (user) {
          const today = new Date().toISOString().slice(0, 10);
          let streakDays = Number(user.streak_days) || 1;
          let coinsAwarded = 50;
          if (user.last_quiz_date) {
            const diff = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(user.last_quiz_date).slice(0, 10)}T00:00:00Z`)) / 86400000);
            if (diff === 0) coinsAwarded = 25;
            else if (diff === 1) streakDays++;
            else streakDays = 1;
          }
          const coins = Number(user.coins ?? 300) + coinsAwarded;
          await client.query('UPDATE users SET coins=$1,streak_days=$2,last_quiz_date=$3 WHERE id=$4', [coins, streakDays, today, req.auth.user_id]);
          streakReward = { coinsAwarded, streakDays, totalCoins: coins };
        }
      }
      return { ...inserted.rows[0], streakReward };
    });
    res.json({ success: true, attemptId: saved.id, authoritative: true, score: Number(saved.score), maxScore: Number(saved.max_score),
      correctCount: saved.correct_count, wrongCount: saved.wrong_count, unansweredCount: saved.unanswered_count,
      accuracy: Number(saved.accuracy), percentile: Number(saved.percentile), estimatedAir: saved.estimated_air,
      timeSpentSeconds: Number(saved.time_spent_seconds) || 0,
      sectionBreakdown: parseJson(saved.section_breakdown_json, []), responses: parseJson(saved.responses_json, {}), streakReward: saved.streakReward || null });
  });

  app.get('/api/attempts', auth, async (req, res) => {
    const values = [req.auth.user_id];
    let sql = 'SELECT a.*,t.type AS test_type FROM test_attempts a LEFT JOIN tests t ON t.id=a.test_id WHERE a.user_id=$1';
    if (req.query.testId || req.query.test_id) { values.push(req.query.testId || req.query.test_id); sql += ` AND a.test_id=$${values.length}`; }
    sql += ' ORDER BY a.completed_at DESC LIMIT 100';
    const result = await pool.query(sql, values);
    res.json({ success: true, attempts: result.rows.map(row => ({ ...row,
      section_breakdown: parseJson(row.section_breakdown_json, []), responses: parseJson(row.responses_json, {}) })) });
  });

  app.get('/api/attempts/:id', auth, async (req, res) => {
    const result = await pool.query('SELECT a.*,t.type AS test_type FROM test_attempts a LEFT JOIN tests t ON t.id=a.test_id WHERE a.id=$1 AND a.user_id=$2', [req.params.id, req.auth.user_id]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Attempt not found.' });
    const row = result.rows[0];
    res.json({ success: true, attempt: { ...row, section_breakdown: parseJson(row.section_breakdown_json, []), responses: parseJson(row.responses_json, {}) } });
  });

  app.get('/api/analytics', auth, async (req, res) => {
    const result = await pool.query(`SELECT a.*,t.type AS test_type FROM test_attempts a LEFT JOIN tests t ON t.id=a.test_id
      WHERE a.user_id=$1 ORDER BY a.completed_at DESC`, [req.auth.user_id]);
    const user = await pool.query('SELECT id,name,roll_no,avatar,target_exam FROM users WHERE id=$1', [req.auth.user_id]);
    const attempts = result.rows.map(row => {
      const rank = examPatterns.calculateTestRankAndPercentile({ testId: row.test_id, testTitle: row.test_title, testType: row.test_type,
        score: row.score, maxScore: row.max_score, correctCount: row.correct_count, wrongCount: row.wrong_count,
        unansweredCount: row.unanswered_count, totalQuestions: row.total_questions, accuracy: row.accuracy });
      return { ...row, percentile: rank.percentile, estimated_air: rank.estimatedAIR, total_candidates: rank.totalCandidates };
    });
    const latest = new Map();
    for (const attempt of attempts) if (!latest.has(attempt.test_id)) latest.set(attempt.test_id, attempt);
    const representatives = [...latest.values()];
    const count = attempts.length, repCount = representatives.length;
    const average = key => repCount ? representatives.reduce((sum, row) => sum + Number(row[key] || 0), 0) / repCount : 0;
    const avgScore = average('score').toFixed(2);
    const avgMax = Math.round(average('max_score'));
    const allSameMax = repCount && representatives.every(row => Number(row.max_score) === Number(representatives[0].max_score));
    const avgPct = repCount ? (representatives.reduce((sum,row) => sum + Number(row.score || 0) / Math.max(1, Number(row.max_score) || 100) * 100, 0) / repCount).toFixed(1) : '0.0';
    const dayNumbers = [...new Set(attempts.map(row => {
      const date = new Date(row.completed_at || row.started_at);
      return Number.isNaN(date.getTime()) ? null : Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
    }).filter(value => value !== null))].sort((a,b) => b-a);
    let streakDays = dayNumbers.length ? 1 : 0;
    for (let i=1; i<dayNumbers.length && dayNumbers[i-1]-dayNumbers[i] === 1; i++) streakDays++;
    const sectionTotals = new Map();
    for (const attempt of representatives) for (const section of parseJson(attempt.section_breakdown_json, [])) {
      const item = sectionTotals.get(section.sectionName) || { sectionName: section.sectionName, correct: 0, wrong: 0, total: 0 };
      item.correct += Number(section.correct || 0); item.wrong += Number(section.wrong || 0);
      item.total += Number(section.total ?? (Number(section.correct || 0) + Number(section.wrong || 0) + Number(section.unanswered || 0)));
      sectionTotals.set(section.sectionName, item);
    }
    const recentAttempts = representatives.slice().reverse().slice(-6).map(row => ({
      testTitle: row.test_title || 'Mock test', score: Number((Number(row.score || 0) / Math.max(1, Number(row.max_score) || 100) * 100).toFixed(1)),
      accuracy: Number(Number(row.accuracy || 0).toFixed(1)), completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
    }));
    const sameScale = allSameMax ? `${avgScore} / ${representatives[0].max_score}` : `${avgScore} / ${avgMax} (${avgPct}%)`;
    res.json({ success: true, user: user.rows[0], stats: { testsAttempted: count, avgScore: sameScale,
      avgAccuracy: `${average('accuracy').toFixed(1)}%`, overallPercentile: `${average('percentile').toFixed(1)}%ile`,
      predictedAIR: repCount ? `#${Math.min(...representatives.map(row => Number(row.estimated_air))).toLocaleString()}` : '#--',
      streakDays: Math.max(1, streakDays), sectionBreakdowns: [...sectionTotals.values()].map(item => ({ ...item,
        accuracy: item.correct + item.wrong ? ((item.correct / (item.correct + item.wrong)) * 100).toFixed(1) : '0' })), recentAttempts } });
  });

  app.get('/api/leaderboard', async (req, res) => {
    const result = await pool.query(`SELECT u.id AS user_id,u.name,u.target_exam,MAX(a.score) AS best_score,MAX(a.percentile) AS percentile
      FROM users u JOIN test_attempts a ON a.user_id=u.id ${req.query.examId && req.query.examId !== 'all' ? 'WHERE u.target_exam=$1' : ''}
      GROUP BY u.id,u.name,u.target_exam ORDER BY best_score DESC LIMIT 50`, req.query.examId && req.query.examId !== 'all' ? [req.query.examId] : []);
    res.json({ success: true, entries: result.rows });
  });

  app.get('/api/quizzes/subjects', auth, async (req, res) => {
    const [bank, solved, user, tests] = await Promise.all([
      pool.query('SELECT subject,COUNT(*)::int AS count FROM quiz_questions GROUP BY subject'),
      pool.query('SELECT subject,COUNT(DISTINCT question_id)::int AS solved_count FROM candidate_quiz_history WHERE user_id=$1 GROUP BY subject', [req.auth.user_id]),
      pool.query('SELECT coins,streak_days FROM users WHERE id=$1', [req.auth.user_id]),
      pool.query('SELECT test_data_json FROM tests')
    ]);
    const map = new Map(bank.rows.map(row => [row.subject.trim(), { subject: row.subject.trim(), bankCount: row.count, totalQuestions: row.count, solvedCount: 0 }]));
    for (const row of tests.rows) for (const section of parseJson(row.test_data_json, {}).sections || []) {
      const title = String(section.title || '').trim();
      if (!title || !section.questions?.length) continue;
      const item = map.get(title) || { subject: title, bankCount: 0, totalQuestions: section.questions.length, solvedCount: 0 };
      item.totalQuestions = Math.max(item.totalQuestions, item.bankCount + section.questions.length);
      map.set(title, item);
    }
    for (const row of solved.rows) {
      const item = map.get(row.subject.trim()) || { subject: row.subject.trim(), bankCount: 0, totalQuestions: Math.max(row.solved_count, 10), solvedCount: 0 };
      item.solvedCount = row.solved_count;
      map.set(item.subject, item);
    }
    for (const subject of ['Reasoning Ability', 'Quantitative Aptitude', 'English Language', 'General Awareness']) {
      if (!map.has(subject)) map.set(subject, { subject, bankCount: 0, totalQuestions: 15, solvedCount: 0 });
    }
    res.json({ success: true, subjects: [...map.values()], userStreak: Number(user.rows[0]?.streak_days || 1), userCoins: Number(user.rows[0]?.coins ?? 300) });
  });

  app.post('/api/quizzes/generate', auth, sameOrigin, async (req, res) => {
    const subject = String(req.body?.subject || '').trim();
    if (!subject) return res.status(400).json({ success: false, error: 'subject is required' });
    const candidates = await pool.query(`SELECT id,subject,question_text,passage_html,image_urls_json,options_json,correct_answer,explanation_html,marks,negative_marks
      FROM quiz_questions WHERE LOWER(subject)=LOWER($1) ORDER BY id`, [subject]);
    const questions = candidates.rows.map(row => ({ id: row.id, section: subject, question: row.question_text, questionText: row.question_text,
      questionHTML: row.question_text, passageHTML: row.passage_html || '', hasPassage: Boolean(row.passage_html?.trim()),
      imageUrls: parseJson(row.image_urls_json, []), options: parseJson(row.options_json, []), correctAnswer: row.correct_answer,
      explanationHTML: row.explanation_html || '', marksForCorrect: Number(row.marks) || 1, negativeMarks: Number(row.negative_marks) || .25 }));
    if (questions.length < 10) {
      const papers = await pool.query('SELECT test_data_json FROM tests');
      for (const row of papers.rows) for (const section of parseJson(row.test_data_json, {}).sections || []) {
        const title = String(section.title || '').trim().toLowerCase();
        if (!title || !(title.includes(subject.toLowerCase()) || subject.toLowerCase().includes(title))) continue;
        for (const q of section.questions || []) {
          const qText = q.questionText || q.question || q.questionHTML || '';
          if (!qText || questions.some(item => item.questionText === qText)) continue;
          questions.push({ ...q, id: q.id || `mock-q-${crypto.randomUUID()}`, section: subject, question: qText,
            questionText: qText, questionHTML: q.questionHTML || qText, options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || (Number.isInteger(q.correctIndex) ? String.fromCharCode(65 + q.correctIndex) : 'A'), explanationHTML: q.explanationHTML || '' });
        }
      }
    }
    if (!questions.length) return res.status(404).json({ success: false, error: `No questions found for subject "${subject}".` });
    const result = await transaction(async client => {
      const history = await client.query('SELECT question_id FROM candidate_quiz_history WHERE user_id=$1 AND LOWER(subject)=LOWER($2)', [req.auth.user_id, subject]);
      const done = new Set(history.rows.map(item => item.question_id));
      let available = questions.filter(item => !done.has(item.id));
      if (available.length < 10) {
        await client.query('DELETE FROM candidate_quiz_history WHERE user_id=$1 AND LOWER(subject)=LOWER($2)', [req.auth.user_id, subject]);
        available = questions;
      }
      available.sort(() => Math.random() - .5);
      const selected = available.slice(0, 10);
      const now = new Date().toISOString();
      for (const q of selected) await client.query('INSERT INTO candidate_quiz_history(user_id,subject,question_id,attempted_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,question_id) DO NOTHING', [req.auth.user_id, subject, q.id, now]);
      selected.forEach((q, index) => { q.globalIndex = index + 1; q.localIndex = index + 1; q.questionNumber = index + 1; q.section = subject; });
      const id = `quiz-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const test = { id, examId: 'daily-quiz', examName: 'Daily Mini Quiz', type: 'daily-quiz', title: `Daily Quiz: ${subject}`,
        subtitle: `Daily Speed Drill • ${selected.length} Questions • 10 Minutes`, marks: selected.length, questionsCount: selected.length,
        durationMinutes: 10, totalDurationSeconds: 600, marksPerCorrect: 1, negativeMarks: .25, isQuiz: true, subject,
        sectionsSummary: [{ id: 'sec-quiz', title: subject, questionsCount: selected.length, maxMarks: selected.length, durationMinutes: 10 }],
        sections: [{ id: 'sec-quiz', title: subject, durationMinutes: 10, durationSeconds: 600, expectedQuestions: selected.length, maxMarks: selected.length, questions: selected }] };
      await client.query(`INSERT INTO tests(id,exam_id,exam_name,type,title,subtitle,marks,questions_count,duration_minutes,marks_per_correct,negative_marks,is_free,sections_summary_json,test_data_json,created_at)
        VALUES($1,'daily-quiz','Daily Mini Quiz','daily-quiz',$2,$3,$4,$5,10,1,.25,1,$6,$7,$8)
        ON CONFLICT(id) DO NOTHING`, [id, test.title, test.subtitle, selected.length, selected.length, JSON.stringify(test.sectionsSummary), JSON.stringify(test), now]);
      return { test, unsolvedRemaining: Math.max(0, available.length - selected.length) };
    });
    res.json({ success: true, test: scrubSolutions(result.test), testId: result.test.id, selectedCount: result.test.questionsCount, unsolvedRemaining: result.unsolvedRemaining });
  });

  app.post('/api/quizzes/import', sameOrigin, requireAdmin, async (req, res) => {
    const subject = String(req.body?.subject || '').trim();
    if (!subject || !req.body?.content) return res.status(400).json({ success: false, error: 'Subject and question content are required.' });
    try {
      const questions = parseQuizQuestions(req.body.content, req.body.format || 'json', subject);
      if (!questions.length) return res.status(400).json({ success: false, error: 'No valid questions could be parsed.' });
      const total = await transaction(async client => {
        const now = new Date().toISOString();
        for (const q of questions) await client.query(`INSERT INTO quiz_questions(id,subject,question_text,passage_html,image_urls_json,options_json,correct_answer,explanation_html,marks,negative_marks,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING`, [q.id, subject, q.questionText, q.passageHTML || '',
          JSON.stringify(q.imageUrls || []), JSON.stringify(q.options || []), q.correctAnswer || 'A', q.explanationHTML || '', Number(q.marks) || 1, Number(q.negativeMarks) || .25, now]);
        const count = (await client.query('SELECT COUNT(*)::int AS count FROM quiz_questions WHERE LOWER(subject)=LOWER($1)', [subject])).rows[0].count;
        await client.query('INSERT INTO admin_audit_log(action,test_id,details_json,created_at) VALUES($1,$2,$3,$4)', ['import_quiz_questions', subject, JSON.stringify({ imported: questions.length, totalInSubject: count, format: req.body.format || 'json' }), now]);
        return count;
      });
      res.json({ success: true, message: `Successfully imported ${questions.length} questions for "${subject}".`, importedCount: questions.length, totalInSubject: total, subject });
    } catch {
      res.status(400).json({ success: false, error: 'Question content could not be parsed.' });
    }
  });

  app.get('/api/quizzes/bank-summary', requireAdmin, async (_req, res) => {
    const summary = await pool.query('SELECT subject,COUNT(*)::int AS count,MIN(created_at) AS first_added,MAX(created_at) AS last_added FROM quiz_questions GROUP BY subject ORDER BY count DESC');
    res.json({ success: true, summary: summary.rows });
  });

  app.post('/api/quizzes/clear-subject', sameOrigin, requireAdmin, async (req, res) => {
    const subject = String(req.body?.subject || '').trim();
    if (!subject) return res.status(400).json({ success: false, error: 'Subject is required.' });
    await transaction(async client => {
      await client.query('DELETE FROM candidate_quiz_history WHERE LOWER(subject)=LOWER($1)', [subject]);
      await client.query('DELETE FROM quiz_questions WHERE LOWER(subject)=LOWER($1)', [subject]);
      await client.query('INSERT INTO admin_audit_log(action,test_id,details_json,created_at) VALUES($1,$2,$3,$4)', ['clear_quiz_subject', subject, JSON.stringify({ subject }), new Date().toISOString()]);
    });
    res.json({ success: true, message: `Cleared questions for "${subject}".` });
  });

  app.get('/api/exam-patterns-2026', (_req, res) => {
    let notifications = {};
    try { notifications = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'official_exam_notifications.json'), 'utf8')); } catch {}
    res.json({ success: true, patterns: examPatterns.EXAM_PATTERNS_2026, notifications });
  });

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/mcp') || path.extname(req.path)) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });

  app.get('/api/admin/tests', requireAdmin, async (_req, res) => {
    const result = await pool.query('SELECT id,exam_id,exam_name,type,title,questions_count,duration_minutes,created_at FROM tests ORDER BY created_at DESC');
    res.json({ success: true, tests: result.rows });
  });

  app.get('/api/admin/tests/:id', requireAdmin, async (req, res) => {
    const result = await pool.query('SELECT test_data_json FROM tests WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Test not found.' });
    res.json({ success: true, test: parseJson(result.rows[0].test_data_json, {}) });
  });

  app.post('/api/admin/save-mock-question', sameOrigin, requireAdmin, async (req, res) => {
    const body = req.body || {};
    if (!body.testId || !body.testTitle || !body.question) return res.status(400).json({ success: false, error: 'testId, testTitle, and question object are required.' });
    const saved = await transaction(async client => {
      const row = (await client.query('SELECT * FROM tests WHERE id=$1 FOR UPDATE', [body.testId])).rows[0];
      const test = row ? parseJson(row.test_data_json, {}) : { id: body.testId, examId: body.examId || 'custom-exam', examName: body.examName || 'Custom Exam', title: body.testTitle,
        subtitle: 'Created via Oliveboard Admin Mock Maker', type: body.testType || 'prelims', durationMinutes: 60, marksPerCorrect: 1, negativeMarks: .25, sections: [] };
      test.sections = Array.isArray(test.sections) ? test.sections : [];
      const sectionTitle = String(body.sectionTitle || 'General').trim();
      let section = test.sections.find(item => String(item.title || '').toLowerCase() === sectionTitle.toLowerCase());
      if (!section) { section = { id: `sec-${crypto.randomUUID()}`, title: sectionTitle, durationMinutes: 20, durationSeconds: 1200, questions: [] }; test.sections.push(section); }
      section.questions = Array.isArray(section.questions) ? section.questions : [];
      const q = body.question, qid = String(q.qid || q.id || `q-${crypto.randomUUID()}`);
      const finalQuestion = { id: qid, qid, sourceQuestionId: qid, section: sectionTitle,
        questionHTML: q.questionHTML || '<p>Question statement</p>', passageHTML: q.passageHTML || '', hasPassage: Boolean(q.passageHTML?.trim()),
        imageUrls: Array.isArray(q.imageUrls) ? q.imageUrls : (q.imageUrls ? [q.imageUrls] : []),
        options: Array.isArray(q.options) ? q.options : [], correctAnswer: q.correctAnswer || 'A',
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : Math.max(0, String(q.correctAnswer || 'A').toUpperCase().charCodeAt(0) - 65),
        explanationHTML: q.explanationHTML || '', marksForCorrect: Number(q.marksForCorrect) || 1, negativeMarks: Number(q.negativeMarks) >= 0 ? Number(q.negativeMarks) : .25 };
      const index = section.questions.findIndex(item => String(item.id || item.qid) === qid);
      if (index < 0) section.questions.push(finalQuestion); else section.questions[index] = { ...section.questions[index], ...finalQuestion };
      let count = 0, marks = 0;
      for (const sec of test.sections) {
        let sectionMarks = 0;
        sec.questions = sec.questions || [];
        sec.questions.forEach((item, i) => { item.globalIndex = ++count; item.localIndex = i + 1; item.questionNumber = count; item.section = sec.title; sectionMarks += Number(item.marksForCorrect) || 1; });
        sec.maxMarks = sectionMarks; sec.expectedQuestions = sec.questions.length; marks += sectionMarks;
      }
      test.questionsCount = count; test.marks = marks;
      test.sectionsSummary = test.sections.map(sec => ({ id: sec.id, title: sec.title, questionsCount: sec.questions.length, maxMarks: sec.maxMarks, durationMinutes: sec.durationMinutes || 20 }));
      const now = new Date().toISOString();
      await client.query(`INSERT INTO tests(id,exam_id,exam_name,type,title,subtitle,marks,questions_count,duration_minutes,marks_per_correct,negative_marks,is_free,sections_summary_json,test_data_json,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$13,$14) ON CONFLICT(id) DO UPDATE SET exam_id=EXCLUDED.exam_id,exam_name=EXCLUDED.exam_name,type=EXCLUDED.type,
        title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,marks=EXCLUDED.marks,questions_count=EXCLUDED.questions_count,duration_minutes=EXCLUDED.duration_minutes,
        marks_per_correct=EXCLUDED.marks_per_correct,negative_marks=EXCLUDED.negative_marks,sections_summary_json=EXCLUDED.sections_summary_json,test_data_json=EXCLUDED.test_data_json`,
      [test.id,test.examId,test.examName,test.type,test.title,test.subtitle || '',marks,count,test.durationMinutes || 60,test.marksPerCorrect || 1,test.negativeMarks ?? .25,JSON.stringify(test.sectionsSummary),JSON.stringify(test),now]);
      await client.query('INSERT INTO admin_audit_log(action,test_id,details_json,created_at) VALUES($1,$2,$3,$4)', ['save_mock_question', test.id, JSON.stringify({ questionId: qid, totalQuestions: count, section: sectionTitle }), now]);
      return { test, finalQuestion };
    });
    res.json({ success: true, testId: saved.test.id, questionId: saved.finalQuestion.id, questionNumber: saved.finalQuestion.questionNumber,
      totalQuestions: saved.test.questionsCount, totalMarks: saved.test.marks, test: saved.test });
  });

  app.post('/api/tests/upload-json', sameOrigin, requireAdmin, async (req, res) => {
    const raw = req.body?.rawPaper;
    if (!raw) return res.status(400).json({ success: false, error: 'rawPaper JSON payload is required.' });
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const normalized = examPatterns.apply2026PatternToQuestionPaper(parsed, {
        examId: req.body.examId, stage: req.body.stage, title: req.body.customTitle || req.body.title,
        testId: req.body.customTestId || req.body.testId, filename: req.body.filename
      });
      const test = normalized.test || normalized;
      const sections = test.sections || [];
      const questionsCount = sections.reduce((sum, section) => sum + (section.questions || []).length, 0);
      const marks = Number(test.marks || sections.reduce((sum, section) => sum + Number(section.maxMarks || 0), 0));
      await transaction(async client => {
        await client.query(`INSERT INTO tests(id,exam_id,exam_name,type,title,subtitle,marks,questions_count,duration_minutes,
          marks_per_correct,negative_marks,is_free,sections_summary_json,test_data_json,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$13,$14)
          ON CONFLICT(id) DO UPDATE SET exam_id=EXCLUDED.exam_id,exam_name=EXCLUDED.exam_name,type=EXCLUDED.type,title=EXCLUDED.title,
          subtitle=EXCLUDED.subtitle,marks=EXCLUDED.marks,questions_count=EXCLUDED.questions_count,duration_minutes=EXCLUDED.duration_minutes,
          marks_per_correct=EXCLUDED.marks_per_correct,negative_marks=EXCLUDED.negative_marks,
          sections_summary_json=EXCLUDED.sections_summary_json,test_data_json=EXCLUDED.test_data_json`, [
          test.id, test.examId || req.body.examId || 'custom', test.examName || 'Custom Exam', test.type || 'mock',
          test.title || req.body.title || 'Custom Mock Test', test.subtitle || '', marks, questionsCount,
          Number(test.durationMinutes || 60), Number(test.marksPerCorrect || 1), Number(test.negativeMarks ?? 0.25),
          JSON.stringify(sections.map(section => `${section.title} (${section.questions?.length || 0} Qs)`)), JSON.stringify(test), new Date().toISOString()
        ]);
        await client.query('INSERT INTO admin_audit_log(action,test_id,details_json,created_at) VALUES($1,$2,$3,$4)', ['upload_or_update_test', test.id, JSON.stringify({ title: test.title, questions: questionsCount }), new Date().toISOString()]);
      });
      res.json({ success: true, testId: test.id, title: test.title, questionsCount });
    } catch {
      res.status(400).json({ success: false, error: 'Question paper could not be validated or saved.' });
    }
  });

  app.post('/api/admin/upload-image', sameOrigin, requireAdmin, (_req, res) => res.status(503).json({ success: false, error: 'Runtime uploads are disabled on ephemeral hosting. Bundle immutable images with the application.' }));
  app.get('/api/admin/images', requireAdmin, (_req, res) => res.json({ success: true, images: [] }));
  app.delete('/api/admin/images/:filename', sameOrigin, requireAdmin, (_req, res) => res.status(404).json({ success: false, error: 'Image not found.' }));
  app.put('/api/admin/users/:id/password', sameOrigin, requireAdmin, async (req, res) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ success: false, error: `A new password of at least ${MIN_PASSWORD_LENGTH} characters is required.` });
    const changed = await transaction(async client => {
      const result = await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(password), req.params.id]);
      if (!result.rowCount) return false;
      await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [req.params.id]);
      await client.query('INSERT INTO admin_audit_log(action,details_json,created_at) VALUES($1,$2,$3)',
        ['provision_candidate_password', JSON.stringify({ userId: req.params.id }), new Date().toISOString()]);
      return true;
    });
    if (!changed) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true });
  });

  const { mountMcpRoutes } = require('./mcp-server');
  mountMcpRoutes(app, null);

  app.use((err, _req, res, _next) => {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[api] request failed:', err.code || 'internal-error');
    res.status(status).json({ success: false, error: status >= 500 ? 'The request could not be completed.' : err.message });
  });
  return app;
}

function start() {
  const port = Number(process.env.PORT) || 3001;
  const app = createApp();
  const server = app.listen(port, () => console.log(`PostgreSQL API listening on port ${port}`));
  const shutdown = () => server.close(() => closePool().finally(() => process.exit(0)));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) start();

module.exports = { createApp, start, scorePaper, scrubSolutions, verifyPassword, hashPassword, publicUser };

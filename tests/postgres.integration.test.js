'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config();
const { getPool, query, transaction, closePool } = require('../db/postgres');
const { createSession, digest } = require('../db/auth');

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL);

test('Neon pool handles concurrent reads within its configured bound', { skip: !enabled }, async () => {
  const pool = getPool();
  const values = await Promise.all(Array.from({ length: 10 }, (_, i) => query('SELECT $1::int AS value', [i])));
  assert.deepEqual(values.map(result => result.rows[0].value), Array.from({ length: 10 }, (_, i) => i));
  assert.ok(pool.totalCount <= 5);
});

test('session hashes, paused revisions, submission idempotency and rollback work in PostgreSQL', { skip: !enabled }, async () => {
  const id = `integration-${crypto.randomUUID()}`;
  const testId = `integration-${crypto.randomUUID()}`;
  const submissionKey = crypto.randomUUID();
  const rolledBack = new Error('expected integration rollback');

  await assert.rejects(transaction(async client => {
    await client.query('INSERT INTO users(id, username, name, created_at, password_hash) VALUES($1,$2,$3,$4,$5)', [
      id, `${id}@example.invalid`, 'Synthetic integration candidate', new Date().toISOString(), 'test-only'
    ]);
    await client.query(`INSERT INTO tests(
      id, exam_id, exam_name, type, title, marks, questions_count, duration_minutes,
      marks_per_correct, negative_marks, created_at
    ) VALUES($1,'test','Test','mock','Synthetic integration test',1,1,1,1,0.25,$2)`, [testId, new Date().toISOString()]);

    const session = await createSession(client, id);
    const storedSession = await client.query('SELECT session_hash, csrf_hash FROM auth_sessions WHERE user_id=$1', [id]);
    assert.equal(storedSession.rowCount, 1);
    assert.equal(storedSession.rows[0].session_hash, digest(session.token));
    assert.equal(storedSession.rows[0].csrf_hash, digest(session.csrfToken));
    assert.notEqual(storedSession.rows[0].session_hash, session.token);

    const save = async revision => client.query(`
      INSERT INTO paused_attempts(user_id,test_id,updated_at,revision,responses_json)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,test_id) DO UPDATE SET
        updated_at=EXCLUDED.updated_at, revision=EXCLUDED.revision, responses_json=EXCLUDED.responses_json
      WHERE paused_attempts.revision < EXCLUDED.revision
    `, [id, testId, new Date().toISOString(), revision, JSON.stringify({ rev: revision })]);
    assert.equal((await save(2)).rowCount, 1);
    assert.equal((await save(1)).rowCount, 0);
    assert.equal((await client.query('SELECT revision FROM paused_attempts WHERE user_id=$1 AND test_id=$2', [id, testId])).rows[0].revision, '2');

    const attempt = (attemptId, key) => client.query(`
      INSERT INTO test_attempts(
        id,user_id,test_id,test_title,total_questions,score,max_score,correct_count,wrong_count,
        unanswered_count,accuracy,percentile,estimated_air,time_spent_seconds,started_at,completed_at,submission_key
      ) VALUES($1,$2,$3,'Synthetic',1,1,1,1,0,0,100,50,1,1,$4,$4,$5)
      ON CONFLICT (user_id, submission_key) WHERE submission_key IS NOT NULL DO NOTHING
      RETURNING id
    `, [attemptId, id, testId, new Date().toISOString(), key]);
    assert.equal((await attempt(`attempt-${crypto.randomUUID()}`, submissionKey)).rowCount, 1);
    assert.equal((await attempt(`attempt-${crypto.randomUUID()}`, submissionKey)).rowCount, 0);
    throw rolledBack;
  }), error => error === rolledBack);

  const user = await query('SELECT 1 FROM users WHERE id=$1', [id]);
  const testRow = await query('SELECT 1 FROM tests WHERE id=$1', [testId]);
  assert.equal(user.rowCount, 0);
  assert.equal(testRow.rowCount, 0);
});

test.after(async () => { await closePool(); });

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  digest,
  readCookie,
  createSession,
  verifyCsrf,
  sessionCookieOptions
} = require('../db/auth');

test('session tokens are stored as hashes and CSRF hashes validate in constant time', async () => {
  let inserted;
  const client = { query: async (_sql, values) => { inserted = values; } };
  const session = await createSession(client, 'synthetic-candidate');
  assert.match(session.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(session.csrfToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(inserted[0], session.token);
  assert.notEqual(inserted[1], session.csrfToken);
  assert.equal(inserted[0], digest(session.token));
  assert.equal(inserted[1], digest(session.csrfToken));
  assert.equal(verifyCsrf({ csrf_hash: inserted[1] }, session.csrfToken), true);
  assert.equal(verifyCsrf({ csrf_hash: inserted[1] }, 'wrong-token'), false);
});

test('session cookie parsing handles encoding and rejects malformed values', () => {
  assert.equal(readCookie({ headers: { cookie: 'x=1; ob_session=opaque%2Btoken; y=2' } }), 'opaque+token');
  assert.equal(readCookie({ headers: { cookie: 'ob_session=%E0%A4%A' } }), null);
  assert.equal(readCookie({ headers: {} }), null);
});

test('production session cookie is HTTP-only, secure, SameSite Lax and scoped to root', () => {
  assert.deepEqual(sessionCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 1_209_600_000
  });
});

'use strict';

const crypto = require('node:crypto');

const SESSION_COOKIE = 'ob_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function digest(value) {
  const pepper = process.env.SESSION_SECRET || 'oliveboard-development-only-session-hash';
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

function constantTimeHexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function readCookie(req, name = SESSION_COOKIE) {
  const header = req.headers?.cookie || '';
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

async function createSession(client, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  await client.query(
    'INSERT INTO auth_sessions(session_hash, csrf_hash, user_id, expires_at) VALUES($1, $2, $3, NOW() + ($4 * INTERVAL \'1 second\'))',
    [digest(token), digest(csrfToken), userId, SESSION_TTL_SECONDS]
  );
  return { token, csrfToken, maxAge: SESSION_TTL_SECONDS };
}

function sessionCookieOptions(production = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000
  };
}

async function loadSession(pool, token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
  const result = await pool.query(`
    SELECT s.session_hash, s.csrf_hash, s.user_id,
           u.username, u.name, u.email, u.avatar, u.roll_no, u.target_exam,
           u.coins, u.streak_days, u.last_quiz_date, u.created_at, u.is_admin
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_hash = $1 AND s.expires_at > NOW()
  `, [digest(token)]);
  return result.rows[0] || null;
}

function verifyCsrf(session, token) {
  if (!session || typeof token !== 'string') return false;
  return constantTimeHexEqual(session.csrf_hash, digest(token));
}

function setSessionCookie(res, token, production = process.env.NODE_ENV === 'production') {
  const options = sessionCookieOptions(production);
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${options.path}`,
    `Max-Age=${Math.floor(options.maxAge / 1000)}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`
  ];
  if (options.secure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res, production = process.env.NODE_ENV === 'production') {
  const attributes = [`${SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (production) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  digest,
  readCookie,
  createSession,
  loadSession,
  verifyCsrf,
  setSessionCookie,
  clearSessionCookie,
  sessionCookieOptions
};

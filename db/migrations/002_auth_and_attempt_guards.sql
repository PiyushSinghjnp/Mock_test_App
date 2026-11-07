-- Additive security/concurrency metadata. Existing candidate data is preserved.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE paused_attempts
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;

ALTER TABLE test_attempts
  ADD COLUMN IF NOT EXISTS submission_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_user_submission_key
  ON test_attempts(user_id, submission_key)
  WHERE submission_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_hash CHAR(64) PRIMARY KEY,
  csrf_hash CHAR(64) NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expiry
  ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_login_limits (
  subject_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  PRIMARY KEY(subject_hash, ip_hash)
);

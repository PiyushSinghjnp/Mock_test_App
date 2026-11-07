-- Additive server-authoritative timer state. Existing attempts and paused rows remain untouched.
CREATE TABLE IF NOT EXISTS active_test_sessions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('active','paused','expired','submitted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_deadline_at TIMESTAMPTZ,
  section_deadline_at TIMESTAMPTZ,
  remaining_seconds INTEGER NOT NULL CHECK (remaining_seconds >= 0),
  section_remaining_seconds INTEGER NOT NULL CHECK (section_remaining_seconds >= 0),
  current_section_index INTEGER NOT NULL DEFAULT 0,
  completed_sections_json TEXT NOT NULL DEFAULT '[]',
  revision BIGINT NOT NULL DEFAULT 0,
  submission_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, test_id),
  UNIQUE (submission_key)
);

CREATE INDEX IF NOT EXISTS idx_active_test_sessions_deadlines
  ON active_test_sessions(state, total_deadline_at)
  WHERE state = 'active';

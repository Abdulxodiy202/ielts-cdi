-- Allow multiple completed sessions per user per test (one per attempt).
-- Only enforce uniqueness for in_progress sessions.
ALTER TABLE test_sessions DROP CONSTRAINT IF EXISTS test_sessions_user_id_test_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS test_sessions_one_in_progress
  ON test_sessions(user_id, test_id)
  WHERE status = 'in_progress';

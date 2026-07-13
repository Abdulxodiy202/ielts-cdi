-- Script Practice attempt history. script_progress keeps only the best
-- per (user, script); script_attempts stores every submission so the
-- Results modal can list them (newest first). Idempotent -- safe to run
-- alongside an already-applied version.

CREATE TABLE IF NOT EXISTS script_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id INT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  accuracy INT NOT NULL,            -- 0..100 percentage
  stars INT NOT NULL DEFAULT 0,     -- 0..5, from calcStarsFromAccuracy
  user_answer TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_attempts_user_script
  ON script_attempts(user_id, script_id, attempted_at DESC);

ALTER TABLE script_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own script attempts" ON script_attempts;
CREATE POLICY "read own script attempts" ON script_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert own script attempts" ON script_attempts;
CREATE POLICY "insert own script attempts" ON script_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

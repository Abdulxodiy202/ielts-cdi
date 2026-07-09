-- Script Practice feature: scripts (admin-managed content) and
-- script_progress (per-user best result, one row per user+script).
-- Run in Supabase Dashboard -> SQL Editor.

CREATE TABLE IF NOT EXISTS scripts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,           -- optional custom image
  audio_url TEXT NOT NULL,
  transcript TEXT NOT NULL,     -- answer key
  duration_seconds INT,         -- audio length
  order_index INT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Progress table (only best result per user per script)
CREATE TABLE IF NOT EXISTS script_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id INT REFERENCES scripts(id) ON DELETE CASCADE,
  best_accuracy INT NOT NULL DEFAULT 0,
  best_stars INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  attempts INT DEFAULT 1,
  last_answer TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, script_id)
);

CREATE INDEX IF NOT EXISTS idx_scripts_order ON scripts(order_index);
CREATE INDEX IF NOT EXISTS idx_script_progress_user ON script_progress(user_id);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read scripts" ON scripts;
CREATE POLICY "Public read scripts" ON scripts
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Own script progress" ON script_progress;
CREATE POLICY "Own script progress" ON script_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

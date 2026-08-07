-- Video Lessons test feature: per-video 30-question multiple-choice
-- test + per-user best-result tracking. Mirrors the article_tests /
-- article_test_results schema pattern.
--
-- Run in Supabase Dashboard -> SQL Editor before deploying (migrations
-- are not automated). Idempotent.

CREATE TABLE IF NOT EXISTS video_tests (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES video_lessons(id) ON DELETE CASCADE,
  question_number INT NOT NULL,          -- 1..30
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_video_tests_video
  ON video_tests(video_id, question_number);

CREATE TABLE IF NOT EXISTS video_test_results (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES video_lessons(id) ON DELETE CASCADE,
  best_score INT NOT NULL,               -- correct answers 0..30
  best_stars INT NOT NULL,               -- 0..5
  last_score INT NOT NULL,
  last_stars INT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_test_results_user
  ON video_test_results(user_id);

ALTER TABLE video_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read video tests" ON video_tests;
CREATE POLICY "read video tests" ON video_tests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "read own video results" ON video_test_results;
CREATE POLICY "read own video results" ON video_test_results
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert own video results" ON video_test_results;
CREATE POLICY "insert own video results" ON video_test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own video results" ON video_test_results;
CREATE POLICY "update own video results" ON video_test_results
  FOR UPDATE USING (auth.uid() = user_id);

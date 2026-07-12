-- Article Test feature: per-article 30-question multiple-choice test
-- plus per-user best-result tracking. Run in Supabase Dashboard -> SQL
-- Editor before deploying -- migrations are not automated.

CREATE TABLE IF NOT EXISTS article_tests (
  id BIGSERIAL PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  question_number INT NOT NULL,          -- 1..30
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_article_tests_article
  ON article_tests(article_id, question_number);

CREATE TABLE IF NOT EXISTS article_test_results (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  best_score INT NOT NULL,               -- correct answers 0..30
  best_stars INT NOT NULL,               -- 0..5
  last_score INT NOT NULL,               -- most recent attempt
  last_stars INT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_article_test_results_user
  ON article_test_results(user_id);

ALTER TABLE article_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read article tests" ON article_tests;
CREATE POLICY "read article tests" ON article_tests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "read own results" ON article_test_results;
CREATE POLICY "read own results" ON article_test_results
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert own results" ON article_test_results;
CREATE POLICY "insert own results" ON article_test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own results" ON article_test_results;
CREATE POLICY "update own results" ON article_test_results
  FOR UPDATE USING (auth.uid() = user_id);

-- Reading + Listening test star gamification. Adds a `stars` column to
-- test_results (0..5, computed at submission from band_score per the
-- calcStarsFromBand mapping in lib/stars.ts) and a per-(user, test) view
-- that surfaces best_stars + best_band + attempts for the test list
-- pages. Idempotent -- safe to re-run.

ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS stars INT;

-- Backfill any existing rows so historical attempts don't render as
-- 0-star. Formula mirrors calcStarsFromBand.
UPDATE test_results
SET stars = CASE
  WHEN band_score >= 8.5 THEN 5
  WHEN band_score >= 8.0 THEN 4
  WHEN band_score >= 7.0 THEN 3
  WHEN band_score >= 6.5 THEN 2
  WHEN band_score >= 6.0 THEN 1
  ELSE 0
END
WHERE stars IS NULL;

CREATE INDEX IF NOT EXISTS idx_test_results_user_test
  ON test_results(user_id, test_id);

-- Rollup view: one row per (user_id, test_id) with best/attempt info.
-- Uses SECURITY INVOKER so it honors the caller's RLS on test_results.
DROP VIEW IF EXISTS user_test_summary;
CREATE VIEW user_test_summary AS
SELECT
  tr.user_id,
  tr.test_id,
  t.type AS test_type,
  MAX(tr.stars) AS best_stars,
  MAX(tr.band_score) AS best_band,
  COUNT(*) AS attempts
FROM test_results tr
JOIN tests t ON t.id = tr.test_id
GROUP BY tr.user_id, tr.test_id, t.type;

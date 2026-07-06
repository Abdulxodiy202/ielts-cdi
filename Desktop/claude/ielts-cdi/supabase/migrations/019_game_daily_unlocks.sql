-- Daily level-unlock limits for the Vocabulary Games puzzle feature.
-- Verified against production: game_progress.unlocked_today/last_unlock_date
-- and the user_daily_unlocks table already exist -- this migration is
-- idempotent (IF NOT EXISTS everywhere) and safe to run again.
--
-- Note: unlocked_today/last_unlock_date on game_progress are NOT used by
-- the application logic (lib/utils/gameUnlock.ts) -- the daily counter is
-- tracked exclusively in user_daily_unlocks, keyed by (user_id, unlock_date).

ALTER TABLE game_progress
  ADD COLUMN IF NOT EXISTS unlocked_today INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_unlock_date DATE DEFAULT NULL;

CREATE TABLE IF NOT EXISTS user_daily_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unlock_date DATE NOT NULL,
  levels_unlocked_today INT DEFAULT 0,
  UNIQUE(user_id, unlock_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_unlocks_user_date
  ON user_daily_unlocks(user_id, unlock_date);

ALTER TABLE user_daily_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own daily unlocks" ON user_daily_unlocks;
CREATE POLICY "Own daily unlocks" ON user_daily_unlocks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

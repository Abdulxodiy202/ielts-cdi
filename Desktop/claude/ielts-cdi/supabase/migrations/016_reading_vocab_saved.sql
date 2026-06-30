-- user_saved_reading_words: saqlangan reading vocabulary so'zlari
-- Run in Supabase SQL Editor if table doesn't exist

CREATE TABLE IF NOT EXISTS user_saved_reading_words (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id    UUID REFERENCES reading_vocabulary(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

ALTER TABLE user_saved_reading_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Saved reading words by owner" ON user_saved_reading_words;
CREATE POLICY "Saved reading words by owner"
  ON user_saved_reading_words FOR ALL TO authenticated
  USING (auth.uid() = user_id);

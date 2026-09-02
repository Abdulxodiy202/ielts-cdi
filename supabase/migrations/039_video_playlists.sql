-- Video Lessons Playlists (YouTube uslubida): playlistlar videolarni
-- tartib bilan guruhlaydi; har bir video ixtiyoriy ravishda bitta
-- playlistga tegishli bo'lishi mumkin (playlist_id).
--
-- Run in Supabase Dashboard -> SQL Editor before deploying (migrations
-- are not automated). Idempotent.

CREATE TABLE IF NOT EXISTS video_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,           -- ixtiyoriy; bo'sh bo'lsa birinchi video thumb'i ishlatiladi
  category TEXT NOT NULL DEFAULT 'ielts' CHECK (category IN ('ielts', 'self_improvement')),
  order_index INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_playlists_category ON video_playlists(category, order_index);

-- video_lessons jadvaliga playlist bog'lanishi. ON DELETE SET NULL --
-- playlist o'chirilsa, ichidagi videolar o'chmaydi, faqat playlistdan
-- ajraladi (standalone videoga aylanadi).
ALTER TABLE video_lessons ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES video_playlists(id) ON DELETE SET NULL;
ALTER TABLE video_lessons ADD COLUMN IF NOT EXISTS order_in_playlist INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_video_lessons_playlist ON video_lessons(playlist_id, order_in_playlist);

ALTER TABLE video_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published playlists" ON video_playlists;
CREATE POLICY "read published playlists" ON video_playlists
  FOR SELECT USING (is_published = true);

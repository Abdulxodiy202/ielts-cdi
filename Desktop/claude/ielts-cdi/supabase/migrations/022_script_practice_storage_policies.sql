-- Script Practice storage policies. Run in Supabase Dashboard -> SQL Editor.
--
-- PREREQUISITE (cannot be done via SQL -- do this first in the dashboard):
-- Storage -> New bucket -> create two PUBLIC buckets named exactly:
--   script_audio
--   script_thumbnails

-- ── script_audio bucket ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin insert script_audio" ON storage.objects;
CREATE POLICY "Admin insert script_audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'script_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update script_audio" ON storage.objects;
CREATE POLICY "Admin update script_audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'script_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete script_audio" ON storage.objects;
CREATE POLICY "Admin delete script_audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'script_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Public read script_audio" ON storage.objects;
CREATE POLICY "Public read script_audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'script_audio');

-- ── script_thumbnails bucket ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admin insert script_thumbnails" ON storage.objects;
CREATE POLICY "Admin insert script_thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'script_thumbnails'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update script_thumbnails" ON storage.objects;
CREATE POLICY "Admin update script_thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'script_thumbnails'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete script_thumbnails" ON storage.objects;
CREATE POLICY "Admin delete script_thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'script_thumbnails'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Public read script_thumbnails" ON storage.objects;
CREATE POLICY "Public read script_thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'script_thumbnails');

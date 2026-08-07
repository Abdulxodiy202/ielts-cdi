-- dictation_audio storage bucket: RLS policies for admin upload + public playback
-- Run in Supabase Dashboard -> SQL Editor if audio upload fails with
-- "new row violates row-level security policy"

DROP POLICY IF EXISTS "Admin insert dictation_audio" ON storage.objects;
CREATE POLICY "Admin insert dictation_audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dictation_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update dictation_audio" ON storage.objects;
CREATE POLICY "Admin update dictation_audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dictation_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete dictation_audio" ON storage.objects;
CREATE POLICY "Admin delete dictation_audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dictation_audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Public read dictation_audio" ON storage.objects;
CREATE POLICY "Public read dictation_audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dictation_audio');

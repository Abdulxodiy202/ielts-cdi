-- Extend admin-only storage write policies to include the second admin
-- (otabekmuminov0427@gmail.com), matching abdulxdiymamajonov@gmail.com's
-- existing access. Run in Supabase Dashboard -> SQL Editor.
--
-- NOTE: every current admin upload route (articles, audio, books, tests,
-- video_lessons) goes through the service-role admin client in application
-- code, which bypasses RLS entirely -- the actual enforcement for those
-- routes is the isAdmin() check in each API route (already updated in the
-- app code to accept both emails), not these policies. These are provided
-- defensively, in case any bucket is ever written to directly from an
-- authenticated client session instead of through an API route, and
-- because 017_dictation_audio_storage_policy.sql already establishes this
-- exact pattern for the dictation_audio bucket. DROP POLICY IF EXISTS
-- makes this safe to run whether or not a given policy currently exists.

-- articles bucket
DROP POLICY IF EXISTS "Admin insert articles" ON storage.objects;
CREATE POLICY "Admin insert articles"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'articles'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update articles" ON storage.objects;
CREATE POLICY "Admin update articles"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'articles'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete articles" ON storage.objects;
CREATE POLICY "Admin delete articles"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'articles'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

-- audio bucket
DROP POLICY IF EXISTS "Admin insert audio" ON storage.objects;
CREATE POLICY "Admin insert audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update audio" ON storage.objects;
CREATE POLICY "Admin update audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete audio" ON storage.objects;
CREATE POLICY "Admin delete audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

-- books bucket
DROP POLICY IF EXISTS "Admin insert books" ON storage.objects;
CREATE POLICY "Admin insert books"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'books'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update books" ON storage.objects;
CREATE POLICY "Admin update books"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'books'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete books" ON storage.objects;
CREATE POLICY "Admin delete books"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'books'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

-- tests bucket
DROP POLICY IF EXISTS "Admin insert tests" ON storage.objects;
CREATE POLICY "Admin insert tests"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tests'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update tests" ON storage.objects;
CREATE POLICY "Admin update tests"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tests'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete tests" ON storage.objects;
CREATE POLICY "Admin delete tests"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tests'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

-- video_lessons bucket
DROP POLICY IF EXISTS "Admin insert video_lessons" ON storage.objects;
CREATE POLICY "Admin insert video_lessons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video_lessons'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin update video_lessons" ON storage.objects;
CREATE POLICY "Admin update video_lessons"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'video_lessons'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

DROP POLICY IF EXISTS "Admin delete video_lessons" ON storage.objects;
CREATE POLICY "Admin delete video_lessons"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'video_lessons'
  AND auth.jwt() ->> 'email' IN (
    'abdulxdiymamajonov@gmail.com',
    'otabekmuminov0427@gmail.com'
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 008_mock_test_submissions.sql
-- Stores student answers for each mock test session.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mock_test_submissions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id)         ON DELETE CASCADE NOT NULL,
  booking_id    uuid REFERENCES public.mock_bookings(id) ON DELETE SET NULL,
  schedule_id   uuid REFERENCES public.mock_schedules(id) ON DELETE SET NULL,
  listening_answers jsonb   DEFAULT '{}',
  reading_answers   jsonb   DEFAULT '{}',
  writing_task1     text    DEFAULT '',
  writing_task2     text    DEFAULT '',
  submitted_at  timestamptz DEFAULT now(),
  status        text        DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted')),
  UNIQUE (user_id, schedule_id)
);

ALTER TABLE public.mock_test_submissions ENABLE ROW LEVEL SECURITY;

-- Students can read and write only their own submissions
CREATE POLICY "Users manage own submissions"
  ON public.mock_test_submissions
  FOR ALL
  USING (auth.uid() = user_id);

-- Admin can read all (for review panel)
CREATE POLICY "Admin can read all submissions"
  ON public.mock_test_submissions
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS mock_test_submissions_user_idx
  ON public.mock_test_submissions (user_id, schedule_id);

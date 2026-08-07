-- ─────────────────────────────────────────────────────────────────────────
-- 007_mock_test_part2.sql
-- Student-facing mock test: link bookings to schedules, writing answers,
-- 1-hour email notification flag.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Add schedule_id FK to mock_bookings
ALTER TABLE public.mock_bookings
  ADD COLUMN IF NOT EXISTS schedule_id uuid
    REFERENCES public.mock_schedules(id) ON DELETE SET NULL;

-- 2. Drop the old time_slot constraint (only '09:00'|'13:00' allowed)
--    so any admin-defined time works.
ALTER TABLE public.mock_bookings
  DROP CONSTRAINT IF EXISTS mock_bookings_time_slot_check;

ALTER TABLE public.mock_bookings
  ADD CONSTRAINT mock_bookings_time_slot_check
    CHECK (time_slot ~ '^[0-9]{2}:[0-9]{2}$');

-- 3. Track whether the 1-hour reminder email was sent for each schedule
ALTER TABLE public.mock_schedules
  ADD COLUMN IF NOT EXISTS email_notified_1h boolean DEFAULT false;

-- 4. Index to find upcoming bookings for a user quickly
CREATE INDEX IF NOT EXISTS mock_bookings_user_schedule_idx
  ON public.mock_bookings (user_id, schedule_id);

-- 5. Writing answers table
CREATE TABLE IF NOT EXISTS public.mock_writing_answers (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_id uuid REFERENCES public.mock_schedules(id) ON DELETE CASCADE NOT NULL,
  task1_answer text NOT NULL DEFAULT '',
  task2_answer text NOT NULL DEFAULT '',
  time_taken   integer,                    -- seconds spent
  submitted_at timestamptz DEFAULT now(),
  UNIQUE (user_id, schedule_id)
);

ALTER TABLE public.mock_writing_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own writing answers"
  ON public.mock_writing_answers
  FOR ALL
  USING (auth.uid() = user_id);

-- Admin can read all answers (for review in admin panel)
CREATE POLICY "Admin can view writing answers"
  ON public.mock_writing_answers
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS mock_writing_answers_schedule_idx
  ON public.mock_writing_answers (schedule_id);

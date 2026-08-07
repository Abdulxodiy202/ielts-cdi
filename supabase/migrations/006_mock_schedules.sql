-- 006_mock_schedules.sql
-- Mock Test scheduling table.
-- Admin creates one row per mock test session; users can book a slot.

CREATE TABLE IF NOT EXISTS public.mock_schedules (
  id                     uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  date                   date        NOT NULL,
  time                   time        NOT NULL,
  status                 text        NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled', 'active', 'completed')),
  -- Reading section: CDI HTML or PDF
  reading_file_url       text,
  -- Listening section: MP3, WAV, or ZIP
  listening_file_url     text,
  -- Writing section
  writing_task1_image_url text,
  writing_task1_topic    text,
  writing_task2_topic    text,
  created_at             timestamptz DEFAULT now()
);

ALTER TABLE public.mock_schedules ENABLE ROW LEVEL SECURITY;

-- Only service role (admin) can read/write
CREATE POLICY "Admin full access to mock_schedules" ON public.mock_schedules
  USING (true) WITH CHECK (true);

-- Index for ordering by date
CREATE INDEX IF NOT EXISTS mock_schedules_date_idx ON public.mock_schedules (date DESC);

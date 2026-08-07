-- Add audio_url to passages (used for listening test sections)
ALTER TABLE public.passages ADD COLUMN IF NOT EXISTS audio_url text;

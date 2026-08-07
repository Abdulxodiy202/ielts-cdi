-- Add file_url column to tests for CDI file uploads
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS file_url text;

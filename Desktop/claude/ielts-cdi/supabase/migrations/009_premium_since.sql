-- 009_premium_since.sql
-- Add premium_since to profiles so we can display subscription start date.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_since timestamptz;

-- Back-fill existing premium users: infer premium_since from premium_until - 1 month
UPDATE public.profiles
SET premium_since = premium_until - INTERVAL '1 month'
WHERE is_premium = true
  AND premium_until IS NOT NULL
  AND premium_since IS NULL;

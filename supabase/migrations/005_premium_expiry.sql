-- 005_premium_expiry.sql
-- premium_until already exists (added in 001_initial_schema.sql).
-- This migration:
--   1. Ensures the column is present (idempotent guard).
--   2. Back-fills any existing premium users who have no expiry set,
--      granting them 1 month from now so they don't lose access immediately.
--   3. Sets is_premium = false for users whose premium_until is in the past,
--      cleaning up any stale "forever premium" flags.

-- Guard: add column if somehow missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

-- Back-fill: premium = true but no expiry → grant 1 month from now
UPDATE public.profiles
SET premium_until = NOW() + INTERVAL '1 month'
WHERE is_premium = true
  AND premium_until IS NULL;

-- Expire: premium = true but expiry already passed → revoke flag
UPDATE public.profiles
SET is_premium = false
WHERE is_premium = true
  AND premium_until IS NOT NULL
  AND premium_until < NOW();

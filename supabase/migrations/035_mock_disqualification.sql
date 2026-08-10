-- 035_mock_disqualification.sql
--
-- Persist cheating disqualification on the booking row so a user who
-- gets flagged during one attempt can't just reopen the tab and try
-- again on the same session. Existing API in /api/mock/disqualify only
-- stamped mock_test_submissions.status='disqualified' — but that row
-- only exists after the user starts the test, so a client-side rule
-- violation before the first submission left no persistent trace.
--
-- Design:
--   - disqualified (bool) — sticky flag, once true never clears for
--     that booking. Kept separate from status so cancellation/rejection
--     flows stay independent.
--   - disqualified_at — when the flag was set (audit).
--   - disqualified_reason — free-text; today only 'cheating_3_violations'
--     but leaving it text-typed avoids another migration when new
--     reasons (audio proctor fail etc.) are added.
--   - Index on (user_id, schedule_id, disqualified) so the frontend's
--     useMyBookings lookup stays a single btree probe.

alter table public.mock_bookings
  add column if not exists disqualified boolean not null default false,
  add column if not exists disqualified_at timestamptz,
  add column if not exists disqualified_reason text;

create index if not exists idx_mock_bookings_disqualified
  on public.mock_bookings (user_id, schedule_id, disqualified);

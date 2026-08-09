-- 034_cleanup_orphan_bookings.sql
--
-- When an admin hard-deletes a mock_schedules row, the FK on
-- mock_bookings.schedule_id (migration 007) is `ON DELETE SET NULL`,
-- so the booking row stays behind with schedule_id=NULL and status=
-- 'pending'/'confirmed'. From the user's tab that reads as "you have
-- a pending session" but there's no schedule to point to any more —
-- confusing, and it keeps the "Waiting for admin" banner alive for a
-- session that no admin will ever act on.
--
-- Fix: BEFORE DELETE trigger on mock_schedules flips every live
-- booking for that schedule to status='cancelled'. Also backfill any
-- orphans left over from before this migration ran.

-- ── 1) Backfill existing orphans ──────────────────────────────────────
-- Any booking with schedule_id=NULL and still-active status has to be
-- a leftover from a pre-trigger schedule delete. Cancel them once so
-- the user's page clears the pending banner on next refresh; the
-- realtime UPDATE fires the useMyBookings hook without a full refetch.
update public.mock_bookings
set status = 'cancelled'
where status in ('pending', 'confirmed')
  and schedule_id is null;

-- Some environments have the older FK without SET NULL, meaning the
-- schedule_id survives even after mock_schedules row is gone. Catch
-- those too: any booking whose schedule_id doesn't resolve to a
-- current mock_schedules row gets cancelled.
update public.mock_bookings b
set status = 'cancelled'
where status in ('pending', 'confirmed')
  and schedule_id is not null
  and not exists (
    select 1 from public.mock_schedules s where s.id = b.schedule_id
  );

-- ── 2) Cleanup trigger on future deletes ──────────────────────────────
-- Runs BEFORE DELETE so the child rows get updated while the parent
-- (and its schedule_id FK target) still exists — otherwise we'd race
-- with the SET NULL cascade.
create or replace function public.mock_schedule_cleanup_bookings()
returns trigger
language plpgsql
as $$
begin
  update public.mock_bookings
  set status = 'cancelled'
  where schedule_id = old.id
    and status in ('pending', 'confirmed');
  return old;
end
$$;

drop trigger if exists trg_mock_schedule_cleanup on public.mock_schedules;
create trigger trg_mock_schedule_cleanup
  before delete on public.mock_schedules
  for each row execute function public.mock_schedule_cleanup_bookings();

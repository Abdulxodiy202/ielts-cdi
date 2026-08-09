-- 032_mock_capacity_confirmed_only.sql
--
-- Booking-flow polish so pending bookings no longer occupy seats:
--
-- 1) CHECK constraint expansion
--    Migration 001 declared status IN ('pending','confirmed','cancelled').
--    Runtime code has been trying to write 'resigned' (mock/schedules
--    auto-resign) and now 'rejected' (Telegram admin reject wiring in
--    032). Add both to the allow-list so those UPDATEs actually persist
--    instead of silently failing the CHECK.
--
-- 2) updated_at column + touch trigger
--    Cooldown after rejection uses updated_at as the anchor: 5 minutes
--    from the moment the row went from pending → rejected. Missing until
--    now, so add + backfill from created_at for existing rows.
--
-- 3) Confirmed-only booking count RPC
--    Pending bookings must NOT occupy a seat — otherwise a user who
--    starts a booking and gets rejected has held someone else's slot
--    hostage in the meantime. The card, the payment guard, and the
--    admin analytics all read via this function.

-- ── 1) status CHECK: allow 'resigned' and 'rejected' too ───────────────
alter table public.mock_bookings
  drop constraint if exists mock_bookings_status_check;
alter table public.mock_bookings
  add constraint mock_bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'resigned', 'rejected'));

-- ── 2) updated_at ──────────────────────────────────────────────────────
alter table public.mock_bookings
  add column if not exists updated_at timestamptz;

-- Backfill so rows created before this migration have SOMETHING sensible
-- when the cooldown timer reads updated_at. Only NULL rows get touched;
-- if a row is somehow already set, keep it.
update public.mock_bookings
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- New rows should default to now() the same as created_at.
alter table public.mock_bookings
  alter column updated_at set default now();

-- Every UPDATE bumps updated_at. Using plpgsql (not a plain assignment)
-- because we also want it to fire when only unrelated columns change —
-- the cooldown anchor is "when did admin last touch this row", not
-- "when did status specifically move to rejected", which keeps future
-- flows (payment_status flips etc.) resetting the timer too.
create or replace function public.mock_bookings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_mock_bookings_updated_at on public.mock_bookings;
create trigger trg_mock_bookings_updated_at
  before update on public.mock_bookings
  for each row execute function public.mock_bookings_touch_updated_at();

-- ── 3) Confirmed-only capacity RPC ─────────────────────────────────────
-- Same signature as migration 031's helper so no consumer needs to
-- change its RPC call; only the WHERE clause tightens from
-- (pending, confirmed) to (confirmed) alone.
create or replace function public.get_schedules_booked_counts(p_schedule_ids uuid[])
returns table (schedule_id uuid, booked_count int)
language sql
stable
security definer
set search_path = public
as $$
  select
    ids.id as schedule_id,
    coalesce(counts.n, 0)::int as booked_count
  from unnest(p_schedule_ids) as ids(id)
  left join (
    select
      mb.schedule_id,
      count(*) as n
    from public.mock_bookings mb
    where mb.status = 'confirmed'
    group by mb.schedule_id
  ) counts on counts.schedule_id = ids.id;
$$;

grant execute on function public.get_schedules_booked_counts(uuid[]) to anon, authenticated;

-- Keep the single-id helper aligned.
create or replace function public.get_schedule_booked_count(p_schedule_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.mock_bookings
  where schedule_id = p_schedule_id
    and status = 'confirmed';
$$;

grant execute on function public.get_schedule_booked_count(uuid) to anon, authenticated;

-- 033_ensure_bookings_setup.sql
--
-- Fully idempotent safety net for the rejection/cooldown flow. Migrations
-- 030-032 already set this up, but real Supabase projects have missed a
-- run more than once, so anything that has to be true for the rejection
-- notification loop is re-asserted here. Running twice is a no-op.
--
-- What this guarantees, in order:
--   1) mock_bookings.status accepts 'rejected' (needed by the Telegram
--      reject callback — else the UPDATE silently fails the CHECK).
--   2) mock_bookings.updated_at exists, defaults to now(), and is
--      touched on every UPDATE via a trigger (cooldown anchor).
--   3) mock_bookings is published to supabase_realtime (client
--      subscription in useMyBookings needs this to fire on UPDATE).
--   4) get_schedules_booked_counts() counts ONLY confirmed rows —
--      pending doesn't hold seats.

-- ── 1) status CHECK: allow 'rejected' + 'resigned' ─────────────────────
alter table public.mock_bookings
  drop constraint if exists mock_bookings_status_check;
alter table public.mock_bookings
  add constraint mock_bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'resigned', 'rejected'));

-- ── 2) updated_at column + backfill + trigger ─────────────────────────
alter table public.mock_bookings
  add column if not exists updated_at timestamptz;

update public.mock_bookings
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.mock_bookings
  alter column updated_at set default now();

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

-- ── 3) Realtime publication ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mock_bookings'
  ) then
    execute 'alter publication supabase_realtime add table public.mock_bookings';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mock_schedules'
  ) then
    execute 'alter publication supabase_realtime add table public.mock_schedules';
  end if;
end $$;

-- ── 4) Confirmed-only capacity RPC ─────────────────────────────────────
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

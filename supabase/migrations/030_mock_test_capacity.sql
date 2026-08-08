-- 030_mock_test_capacity.sql
--
-- Mock Test session capacity limits + realtime booking counter.
--
-- Real table names in this project:
--   mock_schedules  (not mock_test_schedules)
--   mock_bookings   (not mock_test_bookings)
-- The schema follows migrations 001, 006, 007 — schedule_id is uuid and
-- lives on mock_bookings, referencing mock_schedules(id).

-- 1) Capacity: NULL = unlimited, integer >= 1 = hard cap. Existing rows
--    default to NULL so no prior session becomes retroactively full.
alter table public.mock_schedules
  add column if not exists capacity integer;

alter table public.mock_schedules
  drop constraint if exists mock_schedules_capacity_positive;
alter table public.mock_schedules
  add constraint mock_schedules_capacity_positive
  check (capacity is null or capacity >= 1);

-- 2) Index for the counter query — a capacity-limited schedule triggers
--    a COUNT(*) filtered on schedule_id every time the card mounts and
--    on every realtime tick, so keep it fast even at 10k rows.
create index if not exists idx_mock_bookings_schedule
  on public.mock_bookings (schedule_id);

-- 3) Booked-count helper. STABLE + SECURITY DEFINER so unauth'd RPC
--    callers can read the count without needing SELECT rights on
--    mock_bookings themselves; only the aggregate is exposed, not rows.
--    Currently unused by the client (we read count via head:true), but
--    handy for admin dashboards and future server components.
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
    and status in ('pending', 'confirmed');
$$;

grant execute on function public.get_schedule_booked_count(uuid) to anon, authenticated;

-- 4) Realtime: publish mock_bookings so client subscriptions receive
--    INSERT/UPDATE/DELETE events. Use pg_publication_tables to skip
--    when it's already published (adding twice is an error).
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
end $$;

-- 031_mock_schedules_realtime.sql
--
-- Two things migration 030 missed:
--
-- 1) mock_schedules realtime publication
--    Admin edits (time change, capacity change, section files) need to
--    propagate to open user tabs — same trick as the mock_bookings
--    publish in 030, guarded so re-runs are safe.
--
-- 2) RLS-safe batch booking count RPC
--    mock_bookings RLS ("Users can manage own bookings") restricts SELECT
--    to auth.uid() = user_id — so a browser-side COUNT sees only the
--    caller's own bookings and mis-reports remaining seats. The client
--    needs everybody's count for capacity math, but must not read row
--    contents (privacy). A SECURITY DEFINER function returns the
--    aggregate per schedule without exposing individual rows.
--
--    Statuses that occupy a seat: 'pending', 'confirmed'.
--    Statuses that free a seat:   'cancelled', 'resigned'.

-- ── 1) Publish mock_schedules for realtime ─────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mock_schedules'
  ) then
    execute 'alter publication supabase_realtime add table public.mock_schedules';
  end if;
end $$;

-- ── 2) Batch counts RPC ────────────────────────────────────────────────
-- Returns one row per input schedule id (even for ids with zero bookings,
-- so the client can rely on the presence of each row it queried).
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
    where mb.status in ('pending', 'confirmed')
    group by mb.schedule_id
  ) counts on counts.schedule_id = ids.id;
$$;

grant execute on function public.get_schedules_booked_counts(uuid[]) to anon, authenticated;

-- The single-id helper from migration 030 stays; also align its status
-- filter to the same "seat-taken" list documented above so both RPCs
-- agree. If migration 030 has been applied, this replaces the body;
-- if not (fresh DB), the CREATE OR REPLACE still works because the
-- signature is identical.
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

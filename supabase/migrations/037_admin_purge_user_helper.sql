-- 037_admin_purge_user_helper.sql
--
-- Nuclear "delete this user everywhere" helper for the /api/admin/
-- self-destruct route. Supabase's `auth.admin.deleteUser` fails with
-- "Database error deleting user" when any FK still references the
-- auth.users row without ON DELETE CASCADE — auth.identities and
-- app-level payment_requests are the ones this project hits. Doing
-- the cleanup client-side would take multiple round-trips and can
-- half-succeed; a single SECURITY DEFINER function keeps the whole
-- purge atomic (all rolls back on the first failure).
--
-- Scope of the wipe (in order):
--   1. auth schema children — identities, sessions, refresh_tokens,
--      mfa_factors, mfa_challenges, mfa_amr_claims, one_time_tokens.
--      Some tables don't exist in every Supabase project version; each
--      DELETE is wrapped in EXCEPTION WHEN undefined_table so a missing
--      table just logs and moves on instead of aborting.
--   2. public.payment_requests — migration 002 declared the FK without
--      a CASCADE clause, so a live payment_requests row blocks the
--      auth.users delete. Delete it explicitly.
--   3. public.profiles — CASCADE chain drops all public tables that
--      reference profiles (promo_code_usage, vocab_*, referrals) plus
--      auth-cascaded ones drop through auth.users itself.
--   4. auth.users — the row that owns the identity.
--
-- Only service_role can EXECUTE this. anon/authenticated get REVOKE'd
-- so a leaked API route can't be used as a "delete any user" oracle.

create or replace function public.admin_purge_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_table text;
  v_auth_tables text[] := array[
    'identities', 'sessions', 'refresh_tokens',
    'mfa_factors', 'mfa_challenges', 'mfa_amr_claims',
    'one_time_tokens'
  ];
begin
  -- ── 1) auth schema children ────────────────────────────────────────
  foreach v_table in array v_auth_tables loop
    begin
      execute format('delete from auth.%I where user_id = $1', v_table) using p_user_id;
    exception
      when undefined_table then
        raise notice '[admin_purge_user] auth.% missing, skipped', v_table;
      when others then
        raise notice '[admin_purge_user] auth.% failed: %', v_table, sqlerrm;
    end;
  end loop;

  -- ── 2) public.payment_requests (no CASCADE, migration 002) ────────
  begin
    delete from public.payment_requests where user_id = p_user_id;
  exception
    when undefined_table then
      raise notice '[admin_purge_user] payment_requests missing, skipped';
  end;

  -- ── 3) public.profiles ────────────────────────────────────────────
  -- Cascades to everything that references profiles(id).
  delete from public.profiles where id = p_user_id;

  -- ── 4) auth.users ─────────────────────────────────────────────────
  -- Cascades to every public table with `references auth.users on
  -- delete cascade`. After the auth child cleanup above there should
  -- be no blocking FKs left.
  delete from auth.users where id = p_user_id;
end
$$;

revoke execute on function public.admin_purge_user(uuid) from public;
revoke execute on function public.admin_purge_user(uuid) from anon;
revoke execute on function public.admin_purge_user(uuid) from authenticated;
grant  execute on function public.admin_purge_user(uuid) to service_role;

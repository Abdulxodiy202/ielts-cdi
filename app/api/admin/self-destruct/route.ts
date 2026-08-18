export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-config'

/**
 * POST /api/admin/self-destruct
 *
 * Nuclear delete for the admin's OWN account. Used to reset the account
 * back to zero state so we can rehearse the fresh-signup flow end-to-end
 * without spinning up a throwaway email each time.
 *
 * Safety layers, in order:
 *   1. Auth-required (session cookie).
 *   2. Caller email must be in ADMIN_EMAILS (lib/admin-config).
 *   3. Body must contain { confirmation: 'DELETE' } — the frontend
 *      forces the user to type it literally.
 *
 * Actual delete:
 *   Almost every user-scoped table in this project already has
 *   `references auth.users(id) on delete cascade` (or cascades through
 *   `profiles`, which itself cascades from auth.users). The one outlier
 *   is `payment_requests` (migration 002 forgot the CASCADE clause), so
 *   we clean it up manually before firing the auth.admin.deleteUser
 *   call. Anything else added later with a proper CASCADE clause will
 *   Just Work; missing-table errors are swallowed so a partial schema
 *   (e.g. dev DB) doesn't stop the wipe.
 *
 * The response never includes personal detail — just ok/error — so
 * this endpoint is safe to hit even from a debugging session.
 */

const CONFIRMATION_PHRASE = 'DELETE'

// Tables that hang off auth.users WITHOUT ON DELETE CASCADE — must be
// wiped manually before deleting the auth row so no orphan user_id
// values linger. Currently only payment_requests (migration 002).
// Any future tables that miss the CASCADE clause should be added here.
const MANUAL_CLEANUP_TABLES = [
  'payment_requests',
] as const

export async function POST(req: Request) {
  // 1. Auth cookie
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Admin allowlist — same source the /admin page gates on
  if (!isAdmin(user.email)) {
    return Response.json(
      { error: 'forbidden', message: 'Only admin accounts can perform this action' },
      { status: 403 },
    )
  }

  // 3. Explicit confirmation
  let body: { confirmation?: unknown } = {}
  try { body = await req.json() } catch { /* body is required */ }
  if (body.confirmation !== CONFIRMATION_PHRASE) {
    return Response.json(
      {
        error: 'invalid_confirmation',
        message: `Type ${CONFIRMATION_PHRASE} to confirm`,
      },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const userId = user.id
  const userEmail = user.email ?? '(unknown)'

  console.log('[self-destruct] Started, user:', userId, 'email:', userEmail)

  // 4. Single-shot atomic purge via SECURITY DEFINER RPC (migration
  //    037). The RPC cleans auth.identities/sessions/refresh_tokens/
  //    mfa_*/one_time_tokens (all reasons Supabase's own
  //    auth.admin.deleteUser fails with "Database error deleting
  //    user"), then payment_requests (no CASCADE on migration 002),
  //    then profiles (CASCADE fans out to the rest), then auth.users
  //    itself — inside one transaction, so a partial failure rolls
  //    everything back rather than leaving a half-nuked account.
  //
  //    We keep MANUAL_CLEANUP_TABLES as a fallback: if the migration
  //    hasn't been applied yet (RPC returns 42883 = undefined_function),
  //    we walk through them from the app tier so the endpoint still
  //    does *something* useful. That fallback also runs the classic
  //    auth.admin.deleteUser, which will surface the pre-migration
  //    "Database error" if any FK still blocks.
  console.log('[self-destruct] Calling admin_purge_user RPC...')
  const { error: rpcError } = await admin.rpc('admin_purge_user', { p_user_id: userId })

  if (!rpcError) {
    console.log(`[self-destruct] Deleted admin account ${userEmail} (id=${userId}) via RPC`)
    return Response.json({ ok: true })
  }

  // RPC not present yet — fall back to the multi-step flow so a
  // dev database without migration 037 still gets partial cleanup.
  if (rpcError.code === '42883' || /function .* does not exist/i.test(rpcError.message)) {
    console.warn('[self-destruct] admin_purge_user RPC missing, falling back to multi-step')

    for (const table of MANUAL_CLEANUP_TABLES) {
      console.log(`[self-destruct] Cleaning ${table}...`)
      const { error, count } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      if (error) {
        if (error.code === '42P01') {
          console.log(`[self-destruct] ${table}: table missing, skipped`)
        } else {
          console.error(`[self-destruct] Failed ${table}:`, error.message, error.code)
        }
      } else {
        console.log(`[self-destruct] ${table} deleted: ${count ?? 0} rows`)
      }
    }

    console.log('[self-destruct] Deleting profile...')
    const { error: profErr, count: profCount } = await admin
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('id', userId)
    console.log(
      '[self-destruct] Profile result:',
      profErr ? `ERROR ${profErr.code}: ${profErr.message}` : `ok, ${profCount ?? 0} rows`,
    )

    console.log('[self-destruct] Deleting auth user (fallback)...')
    const { data: authRes, error: authError } = await admin.auth.admin.deleteUser(userId)
    console.log(
      '[self-destruct] Auth result:',
      authError
        ? `ERROR: ${authError.message} (status=${authError.status ?? 'n/a'})`
        : 'ok',
      'data:',
      JSON.stringify(authRes),
    )
    if (authError) {
      return Response.json(
        {
          error: 'auth_delete_failed',
          message: authError.message,
          status: authError.status,
          fullError: JSON.stringify(authError),
          hint: 'apply migration 037_admin_purge_user_helper.sql to enable transactional purge',
        },
        { status: 500 },
      )
    }
    console.log(`[self-destruct] Deleted admin account ${userEmail} (id=${userId}) via fallback`)
    return Response.json({ ok: true })
  }

  console.error('[self-destruct] RPC purge failed:', rpcError)
  return Response.json(
    {
      error: 'purge_failed',
      message: rpcError.message,
      code: rpcError.code,
      details: rpcError.details,
      hint: rpcError.hint,
    },
    { status: 500 },
  )
}

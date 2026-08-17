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

  // 4. Manual cleanup for tables missing ON DELETE CASCADE.
  //    Swallow errors per-table so one missing/absent table doesn't
  //    abort the whole wipe — a legacy schema without a table just
  //    means there's nothing to delete there.
  for (const table of MANUAL_CLEANUP_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error && error.code !== '42P01') {
      // 42P01 = undefined_table (table doesn't exist in this env)
      console.warn(`[self-destruct] Failed to clean ${table}:`, error.message)
    }
  }

  // 5. auth.users delete — cascades to profiles, mock_bookings, test_*,
  //    subscriptions, mock_writing_answers, mock_test_submissions,
  //    user_saved_reading_words, user_daily_unlocks, script_progress,
  //    article_test_results, script_attempts, video_test_results, and
  //    through profiles to promo_code_usage, vocab_collections,
  //    vocab_words, referrals. All via existing FK CASCADE.
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('[self-destruct] auth deleteUser failed:', authError)
    return Response.json(
      { error: 'auth_delete_failed', message: authError.message },
      { status: 500 },
    )
  }

  console.log(`[self-destruct] Deleted admin account ${userEmail} (id=${userId})`)
  return Response.json({ ok: true })
}

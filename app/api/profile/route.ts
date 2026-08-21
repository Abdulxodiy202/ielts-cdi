export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/profile — update the caller's own profiles row.
// Accepts { full_name?, display_name?, avatar_url? }; each field is
// applied only if the key is present in the body (undefined skips it).
//
// Diagnostic logging (temporary): the "saves toast success, DB reverts"
// bug reported against display_name has resisted static analysis, so
// every PATCH now logs the BEFORE/UPDATE/AFTER/RECHECK snapshot to
// Vercel Functions output. Once the root cause is found this block
// should shrink back to the terse "0 rows" console.error above.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { full_name, avatar_url, display_name } = body as {
    full_name?: string
    avatar_url?: string
    display_name?: string
  }

  console.log('[profile PATCH] user:', user.id, 'body:', body)

  // BEFORE snapshot -- if this is null we already know the profile row
  // is missing (handle_new_user trigger didn't fire, or RLS is blocking
  // the SELECT too), and no UPDATE will succeed either.
  const { data: before, error: beforeErr } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, updated_at')
    .eq('id', user.id)
    .maybeSingle()
  console.log('[profile PATCH] BEFORE:', before, 'err:', beforeErr?.message)

  const updates: Record<string, unknown> = {}
  if (full_name !== undefined) updates.full_name = full_name.trim() || null
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (display_name !== undefined) updates.display_name = display_name.trim() || null
  if (Object.keys(updates).length > 0) updates.updated_at = new Date().toISOString()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  console.log('[profile PATCH] payload:', updates)

  // Chain `.select().maybeSingle()` so we can distinguish a real success
  // from an RLS-blocked silent no-op -- Postgres returns no error when
  // the policy filters out the row, only an empty result set.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, avatar_url, display_name, updated_at')
    .maybeSingle()
  console.log('[profile PATCH] AFTER update:', updated, 'err:', error?.message, error?.code)

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message, code: error.code }, { status: 500 })
  }
  if (!updated) {
    console.error('[profile PATCH] no_rows_updated -- RLS block or missing profile row', user.id)
    return NextResponse.json(
      { error: 'no_rows_updated', message: 'RLS block or missing profile row' },
      { status: 500 },
    )
  }

  // RECHECK: read the row again after a brief pause so any BEFORE UPDATE
  // trigger that clobbers the new value (or a replica-lag stale read) is
  // visible in the log. If RECHECK.display_name != updates.display_name,
  // a trigger is overwriting the write.
  await new Promise(r => setTimeout(r, 200))
  const { data: recheck } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, updated_at')
    .eq('id', user.id)
    .maybeSingle()
  console.log('[profile PATCH] RECHECK 200ms:', recheck)

  return NextResponse.json({ ok: true, profile: updated, recheck })
}

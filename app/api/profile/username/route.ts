export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Username helpers used by signup, sidebar profile edit, and leaderboard
// inline edit.
//
//   GET  /api/profile/username?value=xxx  -> { available: boolean, valid?: false }
//   PATCH /api/profile/username           -> { username } (auth required)
//
// Validation rule (kept in sync with the client-side regex): 3-20 chars,
// lowercase a-z, digits, underscore. Anything else is rejected as invalid
// -- clients never see "available: true" for a bad string.

const RE = /^[a-z0-9_]{3,20}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const value = (searchParams.get('value') ?? '').trim().toLowerCase()
  if (!RE.test(value)) {
    return NextResponse.json({ available: false, valid: false })
  }
  // Reserved handles the app already generates for skipped display-name
  // onboarding, plus a handful of role words we never want a user to
  // impersonate.
  if (['admin', 'root', 'null', 'undefined', 'system'].includes(value)) {
    return NextResponse.json({ available: false, valid: true, reserved: true })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', value)
    .maybeSingle()

  if (error) {
    // `username` column may not exist yet (migration pending). Fail open
    // so the signup form doesn't block -- Supabase INSERT will still
    // reject a real duplicate.
    return NextResponse.json({ available: true, valid: true, note: 'lookup_error' })
  }
  return NextResponse.json({ available: !data, valid: true })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const raw = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!RE.test(raw)) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }

  // Uniqueness — case-insensitive on lowercase-only column.
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', raw)
    .neq('id', user.id)
    .maybeSingle()
  if (taken) return NextResponse.json({ error: 'Username taken' }, { status: 409 })

  // `.select().maybeSingle()` on an UPDATE returns the row that was
  // actually written -- or NULL when RLS filtered every candidate out.
  // Without this the endpoint would happily return "ok" even when the
  // policy blocked the update, and the client would show a bogus success
  // toast while the DB stayed unchanged. Any null-row response now
  // surfaces as a 500 with a diagnostic instead of a silent no-op.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ username: raw, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('id, username')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) {
    console.error('[profile/username] update returned 0 rows -- RLS or missing profile row', user.id)
    return NextResponse.json(
      { error: 'Profile row not updated (RLS block or missing profile)' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, username: updated.username ?? raw })
}

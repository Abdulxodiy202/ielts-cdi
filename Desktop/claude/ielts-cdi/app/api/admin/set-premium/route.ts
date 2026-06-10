export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

/**
 * PATCH /api/admin/set-premium
 * Body: { userId: string, is_premium: boolean }
 *
 * Flat route — no dynamic [id] segment — eliminates all Next.js routing
 * ambiguity that existed when this lived under /users/[id]/toggle-premium.
 */
export async function PATCH(request: Request) {
  try {
    return await handle(request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[set-premium] ✗ OUTER EXCEPTION:', msg)
    if (err instanceof Error) console.error('[set-premium] stack:', err.stack)
    return NextResponse.json({ error: `Unhandled exception: ${msg}` }, { status: 500 })
  }
}

async function handle(request: Request) {
  console.log('[set-premium] ▶ PATCH called')

  // ── 0. Env check ───────────────────────────────────────────────────────
  const keyLen = process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0
  console.log('[set-premium] SERVICE_ROLE_KEY length:', keyLen)
  if (!keyLen) {
    console.error('[set-premium] ✗ SERVICE_ROLE_KEY missing!')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // ── 1. Auth check ──────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[set-premium] auth user:', user?.email ?? '(null)')
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Body ────────────────────────────────────────────────────────────
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { userId, is_premium } = body as { userId?: unknown; is_premium?: unknown }
  console.log('[set-premium] userId:', userId, '| is_premium:', is_premium, '| typeof:', typeof is_premium)

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'userId must be a non-empty string' }, { status: 400 })
  }
  if (typeof is_premium !== 'boolean') {
    return NextResponse.json({ error: 'is_premium must be boolean' }, { status: 400 })
  }

  // ── 3. Update ──────────────────────────────────────────────────────────
  const admin = createAdminClient()
  console.log('[set-premium] running update for', userId, '→', is_premium)

  const { error } = await admin
    .from('profiles')
    .update({ is_premium })
    .eq('id', userId)

  if (error) {
    console.error('[set-premium] ✗ DB error code   :', error.code)
    console.error('[set-premium] ✗ DB error message:', error.message)
    console.error('[set-premium] ✗ DB error full   :', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[set-premium] ✓ done — is_premium =', is_premium)
  return NextResponse.json({ ok: true, is_premium })
}

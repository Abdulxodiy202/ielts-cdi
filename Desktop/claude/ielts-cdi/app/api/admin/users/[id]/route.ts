export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[toggle-premium] ▶ PATCH called')

  // ── 1. Auth check ──────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[toggle-premium] auth user email:', user?.email ?? '(null)')

  if (!user || user.email !== ADMIN_EMAIL) {
    console.error('[toggle-premium] ✗ Forbidden — got:', user?.email ?? 'null', '| expected:', ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Read params ─────────────────────────────────────────────────────
  const { id } = await params
  console.log('[toggle-premium] target userId:', id)

  // ── 3. Parse body ──────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch (e) {
    console.error('[toggle-premium] ✗ Failed to parse JSON body:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { is_premium } = body as { is_premium?: unknown }
  console.log('[toggle-premium] requested is_premium:', is_premium, '| typeof:', typeof is_premium)

  if (typeof is_premium !== 'boolean') {
    console.error('[toggle-premium] ✗ is_premium is not boolean:', is_premium)
    return NextResponse.json({ error: 'is_premium must be boolean' }, { status: 400 })
  }

  // ── 4. Update — simple, no premium_since / premium_until ───────────────
  const admin = createAdminClient()
  console.log('[toggle-premium] running UPDATE profiles SET is_premium =', is_premium, 'WHERE id =', id)

  const { error } = await admin
    .from('profiles')
    .update({ is_premium })
    .eq('id', id)

  if (error) {
    console.error('[toggle-premium] ✗ DB error:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[toggle-premium] ✓ success — is_premium now:', is_premium)
  return NextResponse.json({ ok: true, is_premium })
}

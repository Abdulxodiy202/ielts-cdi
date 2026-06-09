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

  // ── 0. Env-var sanity check ────────────────────────────────────────────
  // If SUPABASE_SERVICE_ROLE_KEY is not set in Vercel, the admin client is
  // created with key=undefined (TypeScript ! is compile-time only).
  // That produces an invalid JWT and every DB call returns a 401/403.
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const keyLen = process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0
  console.log('[toggle-premium] env — SUPABASE_URL set:', hasUrl, '| SERVICE_ROLE_KEY set:', hasKey, '| key length:', keyLen)

  if (!hasKey) {
    console.error('[toggle-premium] ✗ SUPABASE_SERVICE_ROLE_KEY is missing from environment!')
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set' },
      { status: 500 }
    )
  }

  // ── 1. Auth check (user-session client, reads cookie) ─────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[toggle-premium] auth user:', user?.email ?? '(null)')

  if (!user || user.email !== ADMIN_EMAIL) {
    console.error('[toggle-premium] ✗ Forbidden — got:', user?.email ?? 'null', '| expected:', ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Path param ──────────────────────────────────────────────────────
  const { id } = await params
  console.log('[toggle-premium] target userId:', id)

  // ── 3. Request body ────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch (e) {
    console.error('[toggle-premium] ✗ Cannot parse JSON body:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { is_premium } = body as { is_premium?: unknown }
  console.log('[toggle-premium] is_premium from body:', is_premium, '| typeof:', typeof is_premium)

  if (typeof is_premium !== 'boolean') {
    return NextResponse.json({ error: 'is_premium must be boolean' }, { status: 400 })
  }

  // ── 4. DB update via service-role client (bypasses RLS) ────────────────
  // profiles has RLS: "Users can update own profile" (auth.uid() = id).
  // The regular server client would be blocked from updating other users.
  // createAdminClient() uses SUPABASE_SERVICE_ROLE_KEY → RLS is bypassed.
  try {
    const admin = createAdminClient()
    console.log('[toggle-premium] admin client ready, updating profile...')

    const { error } = await admin
      .from('profiles')
      .update({ is_premium })
      .eq('id', id)

    if (error) {
      // Log every field individually — they all show in Vercel logs
      console.error('[toggle-premium] ✗ DB error code   :', error.code)
      console.error('[toggle-premium] ✗ DB error message:', error.message)
      console.error('[toggle-premium] ✗ DB error details:', error.details)
      console.error('[toggle-premium] ✗ DB error hint   :', error.hint)
      console.error('[toggle-premium] ✗ DB error full   :', JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[toggle-premium] ✓ updated — is_premium =', is_premium)
    return NextResponse.json({ ok: true, is_premium })
  } catch (err) {
    // Catches thrown exceptions (e.g. invalid key, network failure)
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[toggle-premium] ✗ Exception:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

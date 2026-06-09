export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { oneMonthFromNow } from '@/lib/utils/premium'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

/**
 * Returns true when the Supabase/PostgREST error indicates a missing column.
 *  - '42703'    = PostgreSQL "undefined_column" (direct psql connection)
 *  - 'PGRST204' = PostgREST schema-cache miss for an unknown column
 */
function isColumnMissingError(e: unknown): boolean {
  const err = e as { code?: string }
  return err.code === '42703' || err.code === 'PGRST204'
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    console.error('[toggle-premium] Forbidden – user:', user?.email)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { is_premium } = body as { is_premium: boolean }

  if (typeof is_premium !== 'boolean') {
    return NextResponse.json({ error: 'is_premium must be boolean' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const until = oneMonthFromNow().toISOString()

  if (is_premium) {
    // Try with premium_since first (migration 009 adds this column)
    const { error: e1 } = await admin
      .from('profiles')
      .update({ is_premium: true, premium_since: now, premium_until: until })
      .eq('id', id)

    if (e1) {
      // Column missing (42703 from Postgres, PGRST204 from PostgREST schema cache)
      if (isColumnMissingError(e1)) {
        console.log('[toggle-premium] premium_since missing, retrying without it')
        const { error: e2 } = await admin
          .from('profiles')
          .update({ is_premium: true, premium_until: until })
          .eq('id', id)
        if (e2) {
          console.error('[toggle-premium] fallback update error:', e2)
          return NextResponse.json({ error: e2.message }, { status: 500 })
        }
      } else {
        console.error('[toggle-premium] update error:', e1)
        return NextResponse.json({ error: e1.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, is_premium: true, premium_until: until })
  } else {
    // Downgrade — try clearing premium_since too
    const { error: e1 } = await admin
      .from('profiles')
      .update({ is_premium: false, premium_since: null, premium_until: null })
      .eq('id', id)

    if (e1) {
      if (isColumnMissingError(e1)) {
        console.log('[toggle-premium] premium_since missing, retrying without it')
        const { error: e2 } = await admin
          .from('profiles')
          .update({ is_premium: false, premium_until: null })
          .eq('id', id)
        if (e2) {
          console.error('[toggle-premium] fallback update error:', e2)
          return NextResponse.json({ error: e2.message }, { status: 500 })
        }
      } else {
        console.error('[toggle-premium] update error:', e1)
        return NextResponse.json({ error: e1.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, is_premium: false, premium_until: null })
  }
}

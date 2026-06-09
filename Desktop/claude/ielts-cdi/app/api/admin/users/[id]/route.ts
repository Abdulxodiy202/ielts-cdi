export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { oneMonthFromNow } from '@/lib/utils/premium'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

/** PostgreSQL error code for "column does not exist" */
const UNDEFINED_COLUMN = '42703'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
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
    // Try with premium_since (migration 009 adds this column)
    const { error: e1 } = await admin
      .from('profiles')
      .update({ is_premium: true, premium_since: now, premium_until: until })
      .eq('id', id)

    if (e1) {
      // Column doesn't exist yet — fall back without premium_since
      if ((e1 as { code?: string }).code === UNDEFINED_COLUMN) {
        const { error: e2 } = await admin
          .from('profiles')
          .update({ is_premium: true, premium_until: until })
          .eq('id', id)
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: e1.message }, { status: 500 })
      }
    }
  } else {
    // Downgrade — try clearing premium_since too
    const { error: e1 } = await admin
      .from('profiles')
      .update({ is_premium: false, premium_since: null, premium_until: null })
      .eq('id', id)

    if (e1) {
      if ((e1 as { code?: string }).code === UNDEFINED_COLUMN) {
        const { error: e2 } = await admin
          .from('profiles')
          .update({ is_premium: false, premium_until: null })
          .eq('id', id)
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: e1.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

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

  const updateData: Record<string, unknown> = { is_premium }
  if (!is_premium) {
    // Clear premium_until when downgrading
    updateData.premium_until = null
  }

  const { error } = await admin
    .from('profiles')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

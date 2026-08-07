export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { password } = body as { password?: string }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Parol kamida 6 ta belgi bo\'lishi kerak' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { password })

  if (error) {
    console.error('[set-password] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

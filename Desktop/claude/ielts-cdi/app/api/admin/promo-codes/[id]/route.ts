export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  if ('is_active' in body) allowed.is_active = body.is_active
  if ('discount_percent' in body) allowed.discount_percent = body.discount_percent
  if ('valid_from' in body) allowed.valid_from = body.valid_from
  if ('valid_until' in body) allowed.valid_until = body.valid_until
  if ('code' in body) allowed.code = String(body.code).toUpperCase()
  if ('usage_type' in body) allowed.usage_type = body.usage_type
  if ('assigned_user_id' in body) allowed.assigned_user_id = body.assigned_user_id || null

  const { data, error } = await admin
    .from('promo_codes')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('promo_codes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

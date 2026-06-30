export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  if ('title' in body)            allowed.title            = String(body.title).trim()
  if ('description' in body)      allowed.description      = body.description ? String(body.description).trim() : null
  if ('video_url' in body)        allowed.video_url        = String(body.video_url).trim()
  if ('thumbnail_url' in body)    allowed.thumbnail_url    = body.thumbnail_url ? String(body.thumbnail_url).trim() : null
  if ('category' in body)         allowed.category         = String(body.category)
  if ('duration_minutes' in body) allowed.duration_minutes = body.duration_minutes ? Number(body.duration_minutes) : null
  if ('is_premium' in body)       allowed.is_premium       = Boolean(body.is_premium)
  if ('is_published' in body)     allowed.is_published     = Boolean(body.is_published)
  if ('order_index' in body)      allowed.order_index      = Number(body.order_index)

  const { data, error } = await admin
    .from('video_lessons')
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
  const { error } = await admin.from('video_lessons').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

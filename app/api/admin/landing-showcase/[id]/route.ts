export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  if ('title' in body) allowed.title = body.title ? String(body.title).trim() : null
  if ('is_published' in body) allowed.is_published = Boolean(body.is_published)
  if ('order_index' in body) allowed.order_index = Number.isFinite(body.order_index) ? body.order_index : 0

  const { data, error } = await admin
    .from('landing_showcase_images')
    .update(allowed)
    .eq('id', id)
    .select('id, title, image_url, storage_path, order_index, is_published, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('landing_showcase_images')
    .select('storage_path')
    .eq('id', id)
    .single()

  const { error } = await admin.from('landing_showcase_images').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (row?.storage_path) {
    // Storage'dagi faylni ham tozalaymiz -- muvaffaqiyatsiz bo'lsa ham
    // DB qatori allaqachon o'chirilgan, shuning uchun xatoni yutamiz.
    await admin.storage.from('landing').remove([row.storage_path]).catch(() => {})
  }

  return new Response(null, { status: 204 })
}

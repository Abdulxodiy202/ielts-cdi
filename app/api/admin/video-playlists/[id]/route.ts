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
  if ('title' in body)         allowed.title         = String(body.title).trim()
  if ('description' in body)   allowed.description   = body.description ? String(body.description).trim() : null
  if ('thumbnail_url' in body) allowed.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url) : null
  if ('order_index' in body)   allowed.order_index   = Number.isFinite(body.order_index) ? body.order_index : 0
  if ('is_published' in body)  allowed.is_published  = Boolean(body.is_published)
  if ('category' in body && (body.category === 'ielts' || body.category === 'self_improvement')) {
    allowed.category = body.category
  }

  const { data, error } = await admin
    .from('video_playlists')
    .update(allowed)
    .eq('id', id)
    .select('id, title, description, thumbnail_url, category, order_index, is_published, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// Playlistni o'chirish videolarni o'chirmaydi -- video_lessons.playlist_id
// FK'si ON DELETE SET NULL bo'lgani uchun ichidagi videolar shunchaki
// standalone (playlistsiz) videoga aylanadi.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('video_playlists').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

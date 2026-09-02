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

export async function GET() {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  const [playlistsRes, videosRes] = await Promise.all([
    admin
      .from('video_playlists')
      .select('id, title, description, thumbnail_url, category, order_index, is_published, created_at')
      .order('order_index', { ascending: true }),
    admin
      .from('video_lessons')
      .select('id, playlist_id'),
  ])

  if (playlistsRes.error) {
    if ((playlistsRes.error as { code?: string }).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    return Response.json({ error: playlistsRes.error.message }, { status: 500 })
  }

  // Har bir playlist uchun nechta video borligini shu yerda hisoblaymiz
  // -- admin ro'yxatida "N ta video" ko'rsatish uchun.
  const counts = new Map<string, number>()
  for (const v of videosRes.data ?? []) {
    if (!v.playlist_id) continue
    counts.set(v.playlist_id, (counts.get(v.playlist_id) ?? 0) + 1)
  }

  const data = (playlistsRes.data ?? []).map(p => ({ ...p, video_count: counts.get(p.id) ?? 0 }))
  return Response.json(data)
}

const VALID_CATEGORIES = ['ielts', 'self_improvement'] as const
type VideoCategory = (typeof VALID_CATEGORIES)[number]

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { title, description, thumbnail_url, category, order_index, is_published } = body

  if (!title?.trim()) return Response.json({ error: 'Sarlavha kiritilishi shart' }, { status: 400 })

  const cat: VideoCategory = (VALID_CATEGORIES as readonly string[]).includes(category)
    ? (category as VideoCategory)
    : 'ielts'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('video_playlists')
    .insert({
      title:         title.trim(),
      description:   description?.trim() || null,
      thumbnail_url: thumbnail_url || null,
      category:      cat,
      order_index:   Number.isFinite(order_index) ? order_index : 0,
      is_published:  is_published ?? true,
    })
    .select('id, title, description, thumbnail_url, category, order_index, is_published, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ...data, video_count: 0 }, { status: 201 })
}

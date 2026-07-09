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
  const { data, error } = await admin
    .from('video_lessons')
    .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, is_published, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    if ((error as { code?: string }).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { title, video_url, recommendation, is_premium, video_source, thumbnail_url } = body

  if (!title?.trim()) return Response.json({ error: 'Sarlavha kiritilishi shart' }, { status: 400 })
  if (!video_url?.trim()) return Response.json({ error: 'Video URL kiritilishi shart' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('video_lessons')
    .insert({
      title:         title.trim(),
      video_url:     video_url.trim(),
      video_source:  video_source ?? 'youtube',
      thumbnail_url: thumbnail_url ?? null,
      recommendation:recommendation?.trim() ?? null,
      is_premium:    is_premium ?? false,
      is_published:  true,
    })
    .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, is_published, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

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

export async function GET() {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('video_lessons')
    .select('*')
    .order('order_index', { ascending: true })
  if (error) {
    if ((error as { code?: string }).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { title, description, video_url, thumbnail_url, category, duration_minutes, is_premium, is_published, order_index } = body

  if (!title?.trim()) return Response.json({ error: 'Sarlavha kiritilishi shart' }, { status: 400 })
  if (!video_url?.trim()) return Response.json({ error: 'Video URL kiritilishi shart' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('video_lessons')
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      video_url: video_url.trim(),
      thumbnail_url: thumbnail_url?.trim() || null,
      category: category ?? 'general',
      duration_minutes: duration_minutes ? Number(duration_minutes) : null,
      is_premium: is_premium ?? false,
      is_published: is_published ?? true,
      order_index: order_index ?? 0,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

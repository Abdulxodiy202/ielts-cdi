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
    .from('background_music')
    .select('*')
    .order('order_index', { ascending: true })
  if (error) {
    if ((error as any).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { title, youtube_url, order_index, is_active } = body

  if (!title?.trim()) return Response.json({ error: 'Nomi kiritilishi shart' }, { status: 400 })
  if (!youtube_url?.trim()) return Response.json({ error: 'YouTube URL kiritilishi shart' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('background_music')
    .insert({
      title: title.trim(),
      youtube_url: youtube_url.trim(),
      order_index: order_index ?? 0,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

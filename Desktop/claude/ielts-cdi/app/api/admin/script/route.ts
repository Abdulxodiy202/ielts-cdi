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
    .from('scripts')
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
  const {
    title, description, thumbnail_url, audio_url, transcript,
    duration_seconds, order_index, is_premium, is_active,
  } = body

  const wordCount = (transcript ?? '').trim().split(/\s+/).filter(Boolean).length
  if (!title?.trim() || title.trim().length < 3 || title.trim().length > 200) {
    return Response.json({ error: 'Sarlavha 3-200 belgidan iborat bo\'lishi kerak' }, { status: 400 })
  }
  if (!audio_url?.trim()) {
    return Response.json({ error: 'Audio fayl yuklanishi shart' }, { status: 400 })
  }
  if (wordCount < 50) {
    return Response.json({ error: 'Transkript kamida 50 so\'zdan iborat bo\'lishi kerak' }, { status: 400 })
  }
  if (order_index === undefined || order_index === null || Number.isNaN(Number(order_index))) {
    return Response.json({ error: 'Tartib raqami kiritilishi shart' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('scripts')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      thumbnail_url: thumbnail_url || null,
      audio_url: audio_url.trim(),
      transcript: transcript.trim(),
      duration_seconds: duration_seconds ?? null,
      order_index: Number(order_index),
      is_premium: is_premium ?? false,
      is_active: is_active ?? true,
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

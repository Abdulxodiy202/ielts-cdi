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
    .from('game_levels')
    .select('*')
    .order('level_number')
  if (error) {
    if ((error as any).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { level_number, title, description, category, difficulty } = body

  if (!level_number || !title?.trim()) {
    return Response.json({ error: 'level_number and title required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_levels')
    .insert({
      level_number: Number(level_number),
      title: String(title).trim(),
      description: description ?? null,
      category: category ?? 'vocabulary',
      difficulty: difficulty ?? 'medium',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

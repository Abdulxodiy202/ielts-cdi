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
  if ('title' in body) allowed.title = String(body.title).trim()
  if ('description' in body) allowed.description = body.description ?? null
  if ('category' in body) allowed.category = String(body.category)
  if ('difficulty' in body) allowed.difficulty = String(body.difficulty)
  if ('is_active' in body) allowed.is_active = Boolean(body.is_active)

  const { data, error } = await admin.from('game_levels').update(allowed).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('game_levels').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

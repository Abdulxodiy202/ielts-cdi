export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin as isAdminEmail } from '@/lib/admin-config'

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return isAdminEmail(user?.email)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('linking_words')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('linking_words').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

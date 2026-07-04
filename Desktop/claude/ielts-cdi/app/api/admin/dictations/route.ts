export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('dictations').select('*').order('order_index')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, description, audio_url, transcript, order_index, difficulty, is_premium, duration_seconds } = body

  if (!title || !audio_url || !transcript) {
    return Response.json({ error: 'title, audio_url, and transcript required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dictations')
    .insert({ title, description, audio_url, transcript, order_index, difficulty, is_premium, duration_seconds })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

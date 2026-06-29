export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ notes: [] })

  const { searchParams } = new URL(req.url)
  const word_type = searchParams.get('word_type')
  if (!word_type) return Response.json({ error: 'word_type required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('word_notes')
    .select('word_id, note')
    .eq('user_id', user.id)
    .eq('word_type', word_type)

  if (error) {
    console.error('[notes GET] error:', error.message)
    return Response.json({ notes: [] })
  }

  return Response.json({ notes: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { word_id?: string; word_type?: string; note?: string }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { word_id, word_type, note = '' } = body
  if (!word_id || !word_type) return Response.json({ error: 'word_id and word_type required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('word_notes').upsert(
    { user_id: user.id, word_type, word_id, note, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,word_type,word_id' }
  )

  if (error) {
    console.error('[notes POST] upsert error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { word_id?: string }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { word_id } = body
  if (!word_id) return Response.json({ error: 'word_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing, error: selectErr } = await admin
    .from('user_saved_writing_words')
    .select('id')
    .eq('user_id', user.id)
    .eq('word_id', word_id)
    .maybeSingle()

  if (selectErr) {
    console.error('[WC save] select error:', selectErr.message)
    return Response.json({ error: selectErr.message }, { status: 500 })
  }

  if (existing) {
    const { error: delErr } = await admin
      .from('user_saved_writing_words')
      .delete()
      .eq('id', existing.id)
    if (delErr) {
      console.error('[WC save] delete error:', delErr.message)
      return Response.json({ error: delErr.message }, { status: 500 })
    }
    return Response.json({ saved: false })
  } else {
    const { error: insErr } = await admin
      .from('user_saved_writing_words')
      .insert({ user_id: user.id, word_id })
    if (insErr) {
      console.error('[WC save] insert error:', insErr.message)
      return Response.json({ error: insErr.message }, { status: 500 })
    }
    return Response.json({ saved: true })
  }
}

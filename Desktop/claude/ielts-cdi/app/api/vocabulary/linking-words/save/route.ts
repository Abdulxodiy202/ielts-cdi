export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { word_id } = await req.json()
  if (!word_id) return Response.json({ error: 'word_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('user_saved_linking_words')
    .select('id')
    .eq('user_id', user.id)
    .eq('word_id', word_id)
    .maybeSingle()

  if (existing) {
    await admin.from('user_saved_linking_words').delete().eq('id', existing.id)
    return Response.json({ saved: false })
  } else {
    await admin.from('user_saved_linking_words').insert({ user_id: user.id, word_id })
    return Response.json({ saved: true })
  }
}

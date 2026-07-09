export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { message, target = 'all' } = await req.json()
  if (!message?.trim()) {
    return Response.json({ error: 'message kerak' }, { status: 400 })
  }
  if (!['all', 'premium', 'free'].includes(target)) {
    return Response.json({ error: 'target noto\'g\'ri' }, { status: 400 })
  }

  const admin = createAdminClient()

  let query = admin.from('profiles').select('id')
  if (target === 'premium') query = query.eq('is_premium', true)
  if (target === 'free') query = query.eq('is_premium', false)

  const { data: profiles, error: profErr } = await query

  if (profErr) return Response.json({ error: profErr.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return Response.json({ sent: 0 })
  }

  // Batch insert one message per user
  const rows = profiles.map(p => ({
    user_id: p.id,
    message: message.trim(),
  }))

  const { error: insertErr } = await admin.from('admin_messages').insert(rows)
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  return Response.json({ sent: rows.length })
}

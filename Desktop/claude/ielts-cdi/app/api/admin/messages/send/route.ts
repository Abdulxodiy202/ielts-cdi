export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, message } = await req.json()
  if (!userId || !message?.trim()) {
    return Response.json({ error: 'userId va message kerak' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('admin_messages').insert({
    user_id: userId,
    message: message.trim(),
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: msgs, error } = await admin
    .from('admin_messages')
    .select('id, user_id, message, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Fetch profile names/emails for the unique user_ids
  const userIds = [...new Set((msgs ?? []).map(m => m.user_id))]
  const profileMap: Record<string, { full_name: string | null; email: string }> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { full_name: p.full_name, email: p.email }
    }
  }

  const result = (msgs ?? []).map(m => ({
    ...m,
    user_name: profileMap[m.user_id]?.full_name ?? null,
    user_email: profileMap[m.user_id]?.email ?? m.user_id,
  }))

  return Response.json(result)
}

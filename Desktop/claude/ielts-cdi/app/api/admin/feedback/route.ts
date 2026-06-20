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

  const { data: feedbacks, error } = await admin
    .from('feedback')
    .select('id, user_id, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((feedbacks ?? []).map(f => f.user_id))]
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

  const result = (feedbacks ?? []).map(f => ({
    ...f,
    user_name: profileMap[f.user_id]?.full_name ?? null,
    user_email: profileMap[f.user_id]?.email ?? f.user_id,
  }))

  return Response.json(result)
}

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

  // Join with profiles to get user name/email
  const { data, error } = await admin
    .from('admin_messages')
    .select('id, user_id, message, is_read, created_at, profiles!admin_messages_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

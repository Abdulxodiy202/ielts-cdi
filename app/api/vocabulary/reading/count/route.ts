export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('reading_vocabulary')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ count: count ?? 0 }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}

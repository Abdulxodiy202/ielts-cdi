export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('background_music')
    .select('id, title, youtube_url, order_index')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    if ((error as any).code === '42P01') return Response.json([], { status: 200 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

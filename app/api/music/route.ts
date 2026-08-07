export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // is_active null qabul qilinadi -- admin qo'shgan eski qatorlarda
  // maydon to'ldirilmagan bo'lishi mumkin. Faqat is_active=false
  // qatorlar chiqib ketadi.
  const { data, error } = await admin
    .from('background_music')
    .select('id, title, youtube_url, order_index')
    .or('is_active.eq.true,is_active.is.null')
    .order('order_index', { ascending: true })

  if (error) {
    if ((error as any).code === '42P01') return Response.json([], { status: 200 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

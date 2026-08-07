export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [scriptsRes, progressRes] = await Promise.all([
    supabase
      .from('scripts')
      .select('id, title, description, thumbnail_url, duration_seconds, order_index, is_premium, is_active')
      .eq('is_active', true)
      .order('order_index', { ascending: true }),
    supabase
      .from('script_progress')
      .select('script_id, best_accuracy, best_stars, is_completed, attempts')
      .eq('user_id', user.id),
  ])

  if (scriptsRes.error) {
    if ((scriptsRes.error as { code?: string }).code === '42P01') {
      return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    }
    return Response.json({ error: scriptsRes.error.message }, { status: 500 })
  }

  const progressByScript = new Map((progressRes.data ?? []).map(p => [p.script_id, p]))

  const scripts = (scriptsRes.data ?? []).map(s => ({
    ...s,
    progress: progressByScript.get(s.id) ?? null,
  }))

  return Response.json(scripts)
}

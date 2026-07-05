export const dynamic = 'force-dynamic'

// NOTE: If your dictations table is missing the is_active column, run in Supabase SQL editor:
// ALTER TABLE dictations ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [dictationsRes, progressRes] = await Promise.all([
    admin
      .from('dictations')
      .select('id, title, description, order_index, is_premium')
      .eq('is_active', true)
      .order('order_index'),
    admin
      .from('dictation_progress')
      .select('dictation_id, best_accuracy, stars, is_completed')
      .eq('user_id', user.id),
  ])

  const dictations = dictationsRes.data ?? []
  const progress   = progressRes.data ?? []

  const progressMap: Record<number, (typeof progress)[0]> = {}
  for (const p of progress) progressMap[p.dictation_id] = p

  const result = dictations.map(d => ({
    ...d,
    best_accuracy: progressMap[d.id]?.best_accuracy ?? null,
    stars:         progressMap[d.id]?.stars         ?? null,
    is_completed:  progressMap[d.id]?.is_completed  ?? false,
  }))

  return Response.json(result)
}

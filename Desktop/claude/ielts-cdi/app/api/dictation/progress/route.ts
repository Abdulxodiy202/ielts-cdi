export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { dictation_id, accuracy, stars, is_completed } = body

  if (!dictation_id || accuracy === undefined) {
    return Response.json({ error: 'dictation_id and accuracy required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('dictation_progress')
    .select('best_accuracy, attempts, is_completed, stars')
    .eq('user_id', user.id)
    .eq('dictation_id', dictation_id)
    .maybeSingle()

  const bestAccuracy = Math.max(accuracy, existing?.best_accuracy ?? 0)
  const bestStars    = Math.max(stars ?? 0, existing?.stars ?? 0)
  const wasCompleted = existing?.is_completed ?? false
  const nowCompleted = (is_completed ?? false) || wasCompleted
  const attempts     = (existing?.attempts ?? 0) + 1

  const { data, error } = await admin
    .from('dictation_progress')
    .upsert({
      user_id: user.id,
      dictation_id,
      best_accuracy: bestAccuracy,
      stars: bestStars,
      is_completed: nowCompleted,
      attempts,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,dictation_id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

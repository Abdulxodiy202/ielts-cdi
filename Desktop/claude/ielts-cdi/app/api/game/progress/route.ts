export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { level_number, score, max_score, is_completed } = body
  console.log('[progress POST] user:', user.id, 'body:', body)

  if (!level_number || score === undefined) {
    return Response.json({ error: 'level_number and score required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_progress')
    .upsert({
      user_id: user.id,
      level_number,
      score,
      max_score: max_score ?? 5,
      is_completed: is_completed ?? false,
      completed_at: is_completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,level_number' })
    .select()
    .single()

  console.log('[progress POST] upsert result:', { data, error })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

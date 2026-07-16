export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordLevelUnlock } from '@/lib/utils/gameUnlock'
import { grantLeaderboardStars } from '@/lib/utils/leaderboard'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { level_number, score, max_score, is_completed, stars } = body

  if (!level_number || score === undefined) {
    return Response.json({ error: 'level_number and score required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch existing row to keep best score and never downgrade is_completed
  const { data: existing } = await admin
    .from('game_progress')
    .select('score, max_score, is_completed, stars')
    .eq('user_id', user.id)
    .eq('level_number', level_number)
    .maybeSingle()

  const bestScore     = Math.max(score, existing?.score ?? 0)
  const bestStars     = Math.max(stars ?? 0, existing?.stars ?? 0)
  const wasCompleted  = existing?.is_completed ?? false
  const nowCompleted  = (is_completed ?? false) || wasCompleted

  const { data, error } = await admin
    .from('game_progress')
    .upsert({
      user_id: user.id,
      level_number,
      score: bestScore,
      max_score: max_score ?? existing?.max_score ?? 5,
      stars: bestStars,
      is_completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,level_number' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Count this level toward today's daily unlock quota only the first time
  // it's completed — replays and already-completed levels never re-count.
  if (nowCompleted && !wasCompleted) {
    await recordLevelUnlock(admin, user.id, user.email)
  }

  // Leaderboard: delta over previous best stars for this level so
  // replays don't inflate totals.
  await grantLeaderboardStars(admin, user.id, 'game', (stars ?? 0) - (existing?.stars ?? 0))

  return Response.json(data)
}

export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { grantLeaderboardStars } from '@/lib/utils/leaderboard'
import { bumpPlanProgress } from '@/lib/utils/studyPlan'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { script_id, accuracy, stars, is_completed, last_answer } = await request.json()
  if (script_id === undefined || script_id === null || typeof accuracy !== 'number') {
    return Response.json({ error: 'script_id va accuracy kerak' }, { status: 400 })
  }

  // Every submit gets its own row in script_attempts so the Results
  // modal can list history. Best-effort -- if the table doesn't exist
  // yet or the insert fails, we still update script_progress below.
  supabase
    .from('script_attempts')
    .insert({
      user_id: user.id,
      script_id,
      accuracy,
      stars: stars ?? 0,
      user_answer: last_answer ?? null,
    })
    .then(() => { /* fire and forget */ })

  const { data: existing } = await supabase
    .from('script_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('script_id', script_id)
    .maybeSingle()

  if (!existing) {
    const { data, error } = await supabase
      .from('script_progress')
      .insert({
        user_id: user.id,
        script_id,
        best_accuracy: accuracy,
        best_stars: stars ?? 0,
        is_completed: Boolean(is_completed),
        attempts: 1,
        last_answer: last_answer ?? null,
      })
      .select('*')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Leaderboard: first attempt on this script -- whole stars count.
    await grantLeaderboardStars(supabase, user.id, 'script', stars ?? 0)
    // Study plan counts scripts done at >= 3 stars; this is the first
    // attempt, so any >= 3 result is a fresh threshold crossing.
    if ((stars ?? 0) >= 3) await bumpPlanProgress(supabase, user.id, 'script')
    return Response.json(data, { status: 201 })
  }

  const { data, error } = await supabase
    .from('script_progress')
    .update({
      attempts: existing.attempts + 1,
      best_accuracy: Math.max(existing.best_accuracy, accuracy),
      best_stars: Math.max(existing.best_stars ?? 0, stars ?? 0),
      is_completed: existing.is_completed || Boolean(is_completed), // never downgrade
      last_answer: last_answer ?? existing.last_answer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Leaderboard: delta over previous best only, so retakes don't inflate.
  await grantLeaderboardStars(supabase, user.id, 'script', (stars ?? 0) - (existing.best_stars ?? 0))
  // Study plan: only when this attempt CROSSES the 3-star threshold for
  // this script (was < 3 before), so replays never double-count.
  if ((stars ?? 0) >= 3 && (existing.best_stars ?? 0) < 3) {
    await bumpPlanProgress(supabase, user.id, 'script')
  }
  return Response.json(data)
}

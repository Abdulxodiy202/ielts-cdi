import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateBandScore } from '@/lib/utils/bandScore'
import { calcStarsFromBand } from '@/lib/stars'
import { isFullTest } from '@/lib/utils/testCategory'
import { grantLeaderboardStars } from '@/lib/utils/leaderboard'
import { bumpPlanProgress } from '@/lib/utils/studyPlan'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, testId, score, timeTaken, answers } = await req.json()

  if (typeof score !== 'number') {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const bandScore = calculateBandScore(score)
  const stars = calcStarsFromBand(bandScore)
  const admin = createAdminClient()

  // Look up the test's category so we can skip test_results for
  // training/section runs (practice only -- no stars, no history).
  const { data: testMeta } = await admin
    .from('tests')
    .select('type, order_number')
    .eq('id', testId)
    .single()
  const fullTest = isFullTest(testMeta?.type, testMeta?.order_number)

  if (fullTest) {
    // Previous best BEFORE this attempt lands -- leaderboard grant is
    // delta-based so retakes don't inflate totals.
    const { data: prevRows } = await supabase
      .from('test_results')
      .select('stars')
      .eq('user_id', user.id)
      .eq('test_id', testId)
    const prevBest = (prevRows ?? []).reduce((m, r) => Math.max(m, (r.stars as number | null) ?? 0), 0)

    const { error } = await supabase
      .from('test_results')
      .insert({
        user_id: user.id,
        test_id: testId,
        session_id: sessionId,
        raw_score: score,
        band_score: bandScore,
        stars,
        time_taken: typeof timeTaken === 'number' && timeTaken > 0 ? timeTaken : null,
        answers: answers || null,
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const category = testMeta?.type === 'listening' ? 'listening' as const : 'reading' as const
    await grantLeaderboardStars(supabase, user.id, category, stars - prevBest)
    // Study plan: the RPC decides whether this test is part of the plan.
    await bumpPlanProgress(supabase, user.id, category)
  }

  // Mark session completed via admin client (bypasses RLS; unique constraint fixed by migration 015)
  await admin
    .from('test_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), time_remaining: 0 })
    .eq('id', sessionId)

  // Bust the 60-second dashboard cache so results appear immediately
  revalidatePath('/dashboard')

  // Return the derived stars so the CDI iframe client can attach
  // ?justEarned to the exit href and trigger the list-page celebration
  // -- but only when it's actually a full test.
  return NextResponse.json({
    ok: true,
    stars: fullTest ? stars : 0,
    isFullTest: fullTest,
    bandScore,
  })
}

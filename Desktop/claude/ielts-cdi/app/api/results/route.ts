import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBandScore } from '@/lib/utils/bandScore'
import { calcStarsFromBand } from '@/lib/stars'
import { isFullTest } from '@/lib/utils/testCategory'
import { grantLeaderboardStars } from '@/lib/utils/leaderboard'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, testId, timeRemaining } = await req.json()

  // Pulled in parallel with answers so we know if this test is a
  // training/section run (no star save, no celebration) or a full test.
  const [answersRes, testRes] = await Promise.all([
    supabase
      .from('user_answers')
      .select('question_id, user_answer, questions(correct_answer)')
      .eq('session_id', sessionId),
    supabase
      .from('tests')
      .select('type, order_number')
      .eq('id', testId)
      .single(),
  ])

  const answers = answersRes.data
  if (!answers) return NextResponse.json({ error: 'No answers found' }, { status: 400 })

  const fullTest = isFullTest(testRes.data?.type, testRes.data?.order_number)

  // Score answers (case-insensitive)
  let rawScore = 0
  const updates: { id: string; is_correct: boolean }[] = []

  for (const a of answers) {
    const correct = (a.questions as any)?.correct_answer ?? ''
    const isCorrect = (a.user_answer ?? '').trim().toLowerCase() === correct.trim().toLowerCase()
    if (isCorrect) rawScore++
    updates.push({ id: a.question_id, is_correct: isCorrect })
  }

  // Update is_correct in user_answers
  for (const u of updates) {
    await supabase
      .from('user_answers')
      .update({ is_correct: u.is_correct })
      .eq('session_id', sessionId)
      .eq('question_id', u.id)
  }

  const bandScore = calculateBandScore(rawScore)
  const stars = calcStarsFromBand(bandScore)
  const timeTaken = 3600 - timeRemaining

  // Full tests get a persistent row + stars; training/section tests are
  // practice only -- no test_results row, no stars, no history. The
  // session is still marked completed so the card status pill updates.
  let result: unknown = null
  if (fullTest) {
    // Previous best for this test BEFORE inserting the new attempt --
    // the leaderboard grant is delta-based so retakes don't inflate.
    const { data: prevRows } = await supabase
      .from('test_results')
      .select('stars')
      .eq('user_id', user.id)
      .eq('test_id', testId)
    const prevBest = (prevRows ?? []).reduce((m, r) => Math.max(m, (r.stars as number | null) ?? 0), 0)

    const { data, error } = await supabase
      .from('test_results')
      .insert({
        user_id: user.id,
        test_id: testId,
        session_id: sessionId,
        raw_score: rawScore,
        band_score: bandScore,
        stars,
        time_taken: timeTaken,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data

    const category = testRes.data?.type === 'listening' ? 'listening' as const : 'reading' as const
    await grantLeaderboardStars(supabase, user.id, category, stars - prevBest)
  }

  await supabase
    .from('test_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  return NextResponse.json({
    rawScore,
    bandScore,
    stars: fullTest ? stars : 0,
    isFullTest: fullTest,
    timeTaken,
    result,
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('test_results')
    .select('*, tests(type, title)')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBandScore } from '@/lib/utils/bandScore'
import { calcStarsFromBand } from '@/lib/stars'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, testId, timeRemaining } = await req.json()

  // Fetch answers with correct answers
  const { data: answers } = await supabase
    .from('user_answers')
    .select('question_id, user_answer, questions(correct_answer)')
    .eq('session_id', sessionId)

  if (!answers) return NextResponse.json({ error: 'No answers found' }, { status: 400 })

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

  // Save result. `stars` is derived here at submission time so display
  // paths never recompute it -- see [[stars-shared-lib]] for the mapping.
  const { data: result, error } = await supabase
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

  // Mark session completed
  await supabase
    .from('test_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  return NextResponse.json({ rawScore, bandScore, stars, timeTaken, result })
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

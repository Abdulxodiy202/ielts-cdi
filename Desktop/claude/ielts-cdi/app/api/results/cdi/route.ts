import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBandScore } from '@/lib/utils/bandScore'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, testId, score } = await req.json()

  if (typeof score !== 'number') {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const bandScore = calculateBandScore(score)

  // Save result to test_results
  const { error } = await supabase
    .from('test_results')
    .insert({
      user_id: user.id,
      test_id: testId,
      session_id: sessionId,
      raw_score: score,
      band_score: bandScore,
      time_taken: null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark session completed
  await supabase
    .from('test_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  return NextResponse.json({ ok: true })
}

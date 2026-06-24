import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateBandScore } from '@/lib/utils/bandScore'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, testId, score, timeTaken, answers } = await req.json()

  if (typeof score !== 'number') {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const bandScore = calculateBandScore(score)
  const admin = createAdminClient()

  // Save result to test_results
  const { error } = await supabase
    .from('test_results')
    .insert({
      user_id: user.id,
      test_id: testId,
      session_id: sessionId,
      raw_score: score,
      band_score: bandScore,
      time_taken: typeof timeTaken === 'number' && timeTaken > 0 ? timeTaken : null,
      answers: answers || null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark session completed via admin client (bypasses RLS; unique constraint fixed by migration 015)
  await admin
    .from('test_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), time_remaining: 0 })
    .eq('id', sessionId)

  // Bust the 60-second dashboard cache so results appear immediately
  revalidatePath('/dashboard')

  return NextResponse.json({ ok: true })
}

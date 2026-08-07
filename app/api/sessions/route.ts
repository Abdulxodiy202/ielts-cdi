import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testId } = await req.json()

  // Check for existing in-progress session
  const { data: existing } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'in_progress')
    .single()

  if (existing) return NextResponse.json(existing)

  // Create new session — remove unique constraint conflict by handling manually
  const { data, error } = await supabase
    .from('test_sessions')
    .insert({ user_id: user.id, test_id: testId, status: 'in_progress', time_remaining: 3600 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, status, timeRemaining } = await req.json()

  const { data, error } = await supabase
    .from('test_sessions')
    .update({
      status,
      time_remaining: timeRemaining,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

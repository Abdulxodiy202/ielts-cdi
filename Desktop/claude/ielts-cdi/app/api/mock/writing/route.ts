export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** POST /api/mock/writing
 *  Upsert writing answers for a confirmed mock booking.
 *  Body: { schedule_id, task1_answer, task2_answer, time_taken }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { schedule_id, task1_answer, task2_answer, time_taken } = await req.json()
  if (!schedule_id) return Response.json({ error: 'schedule_id required' }, { status: 400 })

  // Only users with a confirmed booking can submit
  const { data: booking } = await supabase
    .from('mock_bookings')
    .select('status')
    .eq('user_id', user.id)
    .eq('schedule_id', schedule_id)
    .maybeSingle()

  if (!booking || booking.status !== 'confirmed') {
    return Response.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('mock_writing_answers')
    .upsert(
      {
        user_id: user.id,
        schedule_id,
        task1_answer: task1_answer ?? '',
        task2_answer: task2_answer ?? '',
        time_taken: time_taken ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,schedule_id' }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** GET /api/mock/writing?schedule_id=xxx
 *  Fetch the user's own writing answer for a schedule.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const schedule_id = searchParams.get('schedule_id')
  if (!schedule_id) return Response.json(null)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('mock_writing_answers')
    .select('*')
    .eq('user_id', user.id)
    .eq('schedule_id', schedule_id)
    .maybeSingle()

  return Response.json(data ?? null)
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/mock/submit
 * Upserts a mock test submission (draft or final).
 * Body: { schedule_id, booking_id?, listening_answers, reading_answers,
 *         writing_task1, writing_task2, status }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    schedule_id,
    booking_id,
    listening_answers = {},
    reading_answers = {},
    writing_task1 = '',
    writing_task2 = '',
    status = 'draft',
  } = body as {
    schedule_id?: string
    booking_id?: string
    listening_answers?: Record<string, string>
    reading_answers?: Record<string, string>
    writing_task1?: string
    writing_task2?: string
    status?: 'draft' | 'submitted'
  }

  if (!schedule_id) {
    return Response.json({ error: 'schedule_id required' }, { status: 400 })
  }

  // Verify the user has a confirmed booking for this schedule
  const { data: booking } = await supabase
    .from('mock_bookings')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('schedule_id', schedule_id)
    .maybeSingle()

  if (!booking || booking.status !== 'confirmed') {
    return Response.json({ error: 'No confirmed booking for this schedule' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Build upsert payload
  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    schedule_id,
    booking_id: booking_id ?? booking.id ?? null,
    listening_answers,
    reading_answers,
    writing_task1,
    writing_task2,
    status,
  }
  if (status === 'submitted') {
    upsertData.submitted_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('mock_test_submissions')
    .upsert(upsertData, { onConflict: 'user_id,schedule_id' })
    .select()
    .single()

  if (error) {
    console.error('[mock/submit] upsert error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, data })
}

/**
 * GET /api/mock/submit?schedule_id=xxx
 * Fetch the user's existing draft for a schedule.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schedule_id = searchParams.get('schedule_id')
  if (!schedule_id) return Response.json(null)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('mock_test_submissions')
    .select('*')
    .eq('user_id', user.id)
    .eq('schedule_id', schedule_id)
    .maybeSingle()

  return Response.json(data ?? null)
}

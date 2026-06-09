export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/schedules
 *  Returns upcoming mock_schedules enriched with:
 *  - userBooking: { status, payment_status } | null
 *  - isSubmitted: true if the user has a 'submitted' entry in mock_test_submissions
 *
 *  Side-effect: auto-resigns confirmed bookings where now > start + 5 min
 *  and no submission (draft or submitted) exists for that schedule.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Upcoming schedules
  const { data: schedules, error } = await admin
    .from('mock_schedules')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!schedules?.length) return Response.json([])

  const ids = schedules.map(s => s.id)

  // Fetch bookings and ALL submissions (not just submitted) in parallel
  const [bookingsRes, submissionsRes] = await Promise.all([
    supabase
      .from('mock_bookings')
      .select('schedule_id, status, payment_status')
      .eq('user_id', user.id)
      .in('schedule_id', ids),
    supabase
      .from('mock_test_submissions')
      .select('schedule_id, status')
      .eq('user_id', user.id)
      .in('schedule_id', ids),
  ])

  const bookingMap: Record<string, { status: string; payment_status: string }> =
    Object.fromEntries((bookingsRes.data ?? []).map(b => [b.schedule_id, b]))

  // Any submission at all (draft or submitted) — used for auto-resign check
  const anySubmissionSet = new Set(
    (submissionsRes.data ?? []).map(s => s.schedule_id)
  )

  // Map schedule_id → submission status (latest status wins)
  const submissionStatusMap: Record<string, string> = {}
  for (const sub of (submissionsRes.data ?? [])) {
    submissionStatusMap[sub.schedule_id] = sub.status
  }

  // Only 'submitted' ones — used for isSubmitted flag
  const submittedSet = new Set(
    (submissionsRes.data ?? []).filter(s => s.status === 'submitted').map(s => s.schedule_id)
  )

  // ── Auto-resign: confirmed bookings where now > start + 5 min + no submission ──
  const now = Date.now()
  const resignScheduleIds: string[] = []

  for (const s of schedules) {
    const booking = bookingMap[s.id]
    if (!booking || booking.status !== 'confirmed') continue
    const startMs = new Date(`${s.date}T${s.time}`).getTime()
    if (now > startMs + 5 * 60 * 1000 && !anySubmissionSet.has(s.id)) {
      resignScheduleIds.push(s.id)
    }
  }

  if (resignScheduleIds.length > 0) {
    // Fire-and-forget DB update (non-blocking for response)
    await admin
      .from('mock_bookings')
      .update({ status: 'resigned' })
      .eq('user_id', user.id)
      .in('schedule_id', resignScheduleIds)

    // Reflect in local map so returned data is immediately correct
    for (const id of resignScheduleIds) {
      if (bookingMap[id]) bookingMap[id] = { ...bookingMap[id], status: 'resigned' }
    }
  }

  return Response.json(
    schedules.map(s => ({
      ...s,
      userBooking:      bookingMap[s.id]           ?? null,
      isSubmitted:      submittedSet.has(s.id),
      submissionStatus: submissionStatusMap[s.id]  ?? null,
    }))
  )
}

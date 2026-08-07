export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Parse a schedule date + time stored as Asia/Tashkent (UTC+5) into a UTC timestamp.
 * Without the +05:00 suffix the server (UTC) mis-reads 09:00 as 09:00 UTC = 14:00 Tashkent.
 */
function tashkentMs(date: string, time: string): number {
  // Normalise to HH:MM (PostgreSQL time may include seconds "09:00:00")
  const hhmm = time.slice(0, 5)
  return new Date(`${date}T${hhmm}:00+05:00`).getTime()
}

/** GET /api/mock/schedules
 *  Returns upcoming mock_schedules enriched with:
 *  - userBooking: { id, status, payment_status } | null
 *  - isSubmitted: true if the user has a 'submitted' entry in mock_test_submissions
 *  - submissionStatus: raw status string ('submitted' | 'disqualified' | 'draft' | null)
 *
 *  Side-effect: auto-resigns confirmed bookings where now > start + 5 min (Tashkent)
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

  // Fetch bookings (with id) and ALL submissions in parallel
  const [bookingsRes, submissionsRes] = await Promise.all([
    supabase
      .from('mock_bookings')
      .select('id, schedule_id, status, payment_status')
      .eq('user_id', user.id)
      .in('schedule_id', ids),
    supabase
      .from('mock_test_submissions')
      .select('schedule_id, status')
      .eq('user_id', user.id)
      .in('schedule_id', ids),
  ])

  // bookingMap: schedule_id → { id, status, payment_status }
  const bookingMap: Record<string, { id: string; status: string; payment_status: string }> = {}
  for (const b of (bookingsRes.data ?? [])) {
    bookingMap[b.schedule_id] = { id: b.id, status: b.status, payment_status: b.payment_status }
  }

  // Any submission at all (draft or submitted) — used for auto-resign check
  const anySubmissionSet = new Set(
    (submissionsRes.data ?? []).map(s => s.schedule_id)
  )

  // Map schedule_id → submission status
  const submissionStatusMap: Record<string, string> = {}
  for (const sub of (submissionsRes.data ?? [])) {
    submissionStatusMap[sub.schedule_id] = sub.status
  }

  // Only 'submitted' ones — isSubmitted flag
  const submittedSet = new Set(
    (submissionsRes.data ?? []).filter(s => s.status === 'submitted').map(s => s.schedule_id)
  )

  // ── Auto-resign: confirmed + now > start+5min (Tashkent) + no submission ──
  const now = Date.now()
  const resignScheduleIds: string[] = []

  for (const s of schedules) {
    const booking = bookingMap[s.id]
    if (!booking || booking.status !== 'confirmed') continue
    const startMs = tashkentMs(s.date, s.time)
    if (now > startMs + 5 * 60 * 1000 && !anySubmissionSet.has(s.id)) {
      resignScheduleIds.push(s.id)
    }
  }

  if (resignScheduleIds.length > 0) {
    const { error: resignErr } = await admin
      .from('mock_bookings')
      .update({ status: 'resigned', resign_reason: 'Vaqtida kirmadi' })
      .eq('user_id', user.id)
      .in('schedule_id', resignScheduleIds)

    // If resign_reason column doesn't exist yet, retry with just status
    if (resignErr) {
      await admin
        .from('mock_bookings')
        .update({ status: 'resigned' })
        .eq('user_id', user.id)
        .in('schedule_id', resignScheduleIds)
    }

    // Reflect immediately in local map
    for (const schedId of resignScheduleIds) {
      if (bookingMap[schedId]) bookingMap[schedId] = { ...bookingMap[schedId], status: 'resigned' }
    }
  }

  return Response.json(
    schedules.map(s => ({
      ...s,
      userBooking:      bookingMap[s.id]          ?? null,
      isSubmitted:      submittedSet.has(s.id),
      submissionStatus: submissionStatusMap[s.id] ?? null,
    }))
  )
}

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
 *  Also includes the CURRENT USER's own confirmed/resigned bookings for
 *  schedules up to 24h in the past, even though those fall outside the
 *  normal "upcoming" window -- otherwise a booking that should get
 *  auto-resigned (missed the 5-min grace) simply disappears from the
 *  page on the next load instead of showing the "siz kechikdingiz"
 *  message, and the auto-resign side-effect below never gets a chance
 *  to run for it either (see widening step below).
 *
 *  Side-effect: auto-resigns confirmed bookings where now > start + 5 min (Tashkent)
 *  and no submission (draft or submitted) exists for that schedule.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = Date.now()

  // Compute today's date + current time in Asia/Tashkent (UTC+5) so the
  // date/time filter matches what the schedule was authored in. Using the
  // server's UTC would drop today's evening sessions the moment UTC rolls
  // past midnight — Uzbekistan users would lose the last 5 hours of the
  // day for no reason.
  const nowTashkent = new Date(now + 5 * 60 * 60 * 1000) // shift to UTC+5
  const today = nowTashkent.toISOString().split('T')[0]           // YYYY-MM-DD (Tashkent)

  // Upcoming schedules: (date > today) OR (date = today AND time >= now-5min).
  // The 5-min grace is the same window the client uses for "you can still
  // start" — filtering server-side more aggressively would remove sessions
  // the user is legitimately about to enter. Anything older than that is
  // silently dropped so past cards don't clutter the list.
  //
  // If Supabase rejects the OR shape (e.g. quoting quirks), the outer
  // catch below falls back to the date-only filter so the page never
  // 500s just because a filter refactor misfired.
  type ScheduleRow = { id: string; date: string; time: string; [k: string]: unknown }
  const graceMs = 5 * 60 * 1000
  const cutoffTashkent = new Date(nowTashkent.getTime() - graceMs).toISOString().slice(11, 19)
  const primaryRes = await admin
    .from('mock_schedules')
    .select('*')
    .or(`date.gt.${today},and(date.eq.${today},time.gte.${cutoffTashkent})`)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  let schedules = primaryRes.data as ScheduleRow[] | null
  let fetchError = primaryRes.error
  if (fetchError) {
    console.warn('[mock/schedules] OR filter failed, falling back to date-only:', fetchError.message)
    const fallbackRes = await admin
      .from('mock_schedules')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    schedules = fallbackRes.data as ScheduleRow[] | null
    fetchError = fallbackRes.error
  }

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 })

  // Widen with the user's OWN confirmed/resigned bookings whose schedule
  // fell just outside the "upcoming" window above (bounded to the last
  // 24h so genuinely old history never clutters the list). This is what
  // lets a student who missed the 5-min grace still see their session on
  // the page -- and lets the auto-resign loop below actually see it and
  // flip the booking to 'resigned', instead of it silently vanishing
  // while still marked 'confirmed' forever.
  const primaryIds = new Set((schedules ?? []).map(s => s.id))
  const { data: myActiveBookings } = await supabase
    .from('mock_bookings')
    .select('schedule_id')
    .eq('user_id', user.id)
    .in('status', ['confirmed', 'resigned'])

  const missingIds = [...new Set(
    (myActiveBookings ?? [])
      .map(b => b.schedule_id as string | null)
      .filter((id): id is string => !!id && !primaryIds.has(id))
  )]

  if (missingIds.length > 0) {
    const { data: pastSchedules } = await admin
      .from('mock_schedules')
      .select('*')
      .in('id', missingIds)
    const DAY_MS = 24 * 60 * 60 * 1000
    const recentPast = ((pastSchedules ?? []) as ScheduleRow[]).filter(
      ps => now - tashkentMs(ps.date, ps.time) <= DAY_MS
    )
    if (recentPast.length > 0) {
      schedules = [...(schedules ?? []), ...recentPast]
    }
  }

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
  // (`now` was captured once at the top of the request, above.)
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

  // ── Auto-reactivate: resigned bookings whose schedule was later
  //    edited to a still-in-the-future (or within 5-min grace) time.
  //    Without this, an admin pushing a session from 03:15 → 03:20
  //    after the user was auto-resigned leaves the user permanently
  //    stuck on the "you were late" banner while the countdown to
  //    the new time ticks in the same card. Idempotent — resigned
  //    rows past the new time+grace stay resigned. ── */
  const reactivateScheduleIds: string[] = []
  for (const s of schedules) {
    const booking = bookingMap[s.id]
    if (!booking || booking.status !== 'resigned') continue
    // Skip rows the user has already submitted for — reactivation
    // shouldn't overwrite a real attempt.
    if (anySubmissionSet.has(s.id)) continue
    const startMs = tashkentMs(s.date, s.time)
    if (now < startMs + 5 * 60 * 1000) {
      reactivateScheduleIds.push(s.id)
    }
  }

  if (reactivateScheduleIds.length > 0) {
    const { error: reErr } = await admin
      .from('mock_bookings')
      .update({ status: 'confirmed' })
      .eq('user_id', user.id)
      .in('schedule_id', reactivateScheduleIds)
      .eq('status', 'resigned')
    if (reErr) {
      console.error('[mock/schedules] reactivate error:', reErr.message)
    } else {
      for (const schedId of reactivateScheduleIds) {
        if (bookingMap[schedId]) bookingMap[schedId] = { ...bookingMap[schedId], status: 'confirmed' }
      }
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

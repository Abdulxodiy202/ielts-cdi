import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch submissions, resigned bookings, schedule, AND the new
  // mock_writing_submissions rows in parallel. The new table is a
  // separate write path used by the CDI-HTML writing flow (candidate
  // IDs land here as TEXT user_ids), so we merge/append its rows
  // below. It's fine if the table doesn't exist yet in this env --
  // Supabase returns a PGRST205 (table not found) and we treat it as
  // "no rows" so the endpoint keeps working.
  const [submissionsRes, resignedRes, scheduleRes, writingRes] = await Promise.all([
    admin
      .from('mock_test_submissions')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('submitted_at', { ascending: true, nullsFirst: false }),
    admin
      .from('mock_bookings')
      .select('id, user_id, schedule_id, created_at')
      .eq('schedule_id', scheduleId)
      .eq('status', 'resigned'),
    admin
      .from('mock_schedules')
      .select('date, time_slot')
      .eq('id', scheduleId)
      .single(),
    admin
      .from('mock_writing_submissions')
      .select('id, user_id, task1_answer, task2_answer, task1_words, task2_words, submitted_at')
      .eq('schedule_id', scheduleId),
  ])

  const submissions = submissionsRes.data ?? []
  const resignedBookings = resignedRes.data ?? []
  const schedule = scheduleRes.data

  // Writing-only rows -- key them by user_id for O(1) lookup below.
  // If the table is missing, writingRes.data is null and this stays empty.
  interface WritingRow {
    id: string
    user_id: string
    task1_answer: string | null
    task2_answer: string | null
    task1_words: number | null
    task2_words: number | null
    submitted_at: string | null
  }
  const writingRows = (writingRes.data ?? []) as WritingRow[]
  const writingByUserId = new Map<string, WritingRow>()
  for (const w of writingRows) writingByUserId.set(w.user_id, w)

  if (submissionsRes.error) {
    return NextResponse.json({ error: submissionsRes.error.message }, { status: 500 })
  }

  // Collect all unique user IDs from both sources
  const submissionUserIds = submissions.map((s: any) => s.user_id)
  const resignedUserIds   = resignedBookings.map((b: any) => b.user_id)
  // Exclude resigned users that already have a submission (e.g. disqualified)
  const submissionUserSet = new Set(submissionUserIds)
  const pureResignedBookings = resignedBookings.filter((b: any) => !submissionUserSet.has(b.user_id))

  const allUserIds = [...new Set([...submissionUserIds, ...pureResignedBookings.map((b: any) => b.user_id)])]

  if (allUserIds.length === 0) {
    return NextResponse.json([])
  }

  // Collect booking IDs so we can look up payment_requests for phone numbers
  const bookingIdsFromSubmissions = submissions.map((s: any) => s.booking_id).filter(Boolean)
  const bookingIdsFromResigned    = pureResignedBookings.map((b: any) => b.id)
  const allBookingIds = [...new Set([...bookingIdsFromSubmissions, ...bookingIdsFromResigned])]

  // Fetch profiles + bookings (for payment_ref → phone, and
  // user_name/user_phone -- migration 038, populated by free bookings
  // which have no payment_requests row to read from) in parallel
  const [profilesRes, bookingsForPhoneResRaw] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, phone, is_premium')
      .in('id', allUserIds),
    allBookingIds.length > 0
      ? admin
          .from('mock_bookings')
          .select('id, user_id, payment_ref, user_name, user_phone')
          .in('id', allBookingIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ])
  // Migration 038 not run yet — retry without the two new columns.
  let bookingsForPhoneRes = bookingsForPhoneResRaw
  if ((bookingsForPhoneRes as any).error?.code === '42703') {
    bookingsForPhoneRes = await admin
      .from('mock_bookings')
      .select('id, user_id, payment_ref')
      .in('id', allBookingIds)
  }

  const profileMap: Record<string, any> = {}
  for (const p of profilesRes.data ?? []) {
    profileMap[p.id] = p
  }

  // Build payment_requests phone lookup: user_id → phone
  // mock_bookings.payment_ref format: "PR-<uuid>"
  const paymentReqIds: string[] = []
  for (const b of bookingsForPhoneRes.data ?? []) {
    if (b.payment_ref && typeof b.payment_ref === 'string' && b.payment_ref.startsWith('PR-')) {
      paymentReqIds.push(b.payment_ref.slice(3))
    }
  }

  const paymentPhoneMap: Record<string, string> = {}
  if (paymentReqIds.length > 0) {
    const { data: prs } = await admin
      .from('payment_requests')
      .select('id, user_id, user_phone')
      .in('id', paymentReqIds)
    for (const pr of prs ?? []) {
      if (pr.user_phone) paymentPhoneMap[pr.user_id] = pr.user_phone
    }
  }

  // Booking-level name/phone (free bookings), keyed by booking id --
  // submissions/resigned rows reference a specific booking_id, and a
  // user could in principle have booked more than one schedule.
  const bookingContactMap: Record<string, { user_name?: string; user_phone?: string }> = {}
  for (const b of bookingsForPhoneRes.data ?? []) {
    bookingContactMap[b.id] = { user_name: (b as any).user_name, user_phone: (b as any).user_phone }
  }

  // Enrich submissions. If a mock_writing_submissions row exists for
  // the same user_id (string match), its task1_answer/task2_answer
  // overrides the old mock_test_submissions.writing_task1/task2 --
  // the new table is the source of truth for the CDI-HTML flow.
  const enrichedSubmissions = submissions.map((s: any) => {
    const profile = profileMap[s.user_id] ?? {}
    const bookingContact = bookingContactMap[s.booking_id] ?? {}
    // Phone priority: payment_requests (paid) → booking's own user_phone
    // (free bookings) → profiles.phone → ''. Same priority for name.
    const userPhone = paymentPhoneMap[s.user_id] || bookingContact.user_phone || profile.phone || ''
    const userName = bookingContact.user_name || profile.full_name || 'Noma\'lum'
    const w = writingByUserId.get(s.user_id) ?? null
    return {
      id: s.id,
      user_id: s.user_id,
      booking_id: s.booking_id,
      user_name: userName,
      user_email: profile.email ?? s.user_id,
      user_phone: userPhone,
      is_premium: profile.is_premium ?? false,
      schedule_date: schedule?.date ?? null,
      schedule_time: schedule?.time_slot ?? null,
      listening_answers: s.listening_answers ?? {},
      reading_answers: s.reading_answers ?? {},
      writing_task1: (w?.task1_answer ?? s.writing_task1) ?? '',
      writing_task2: (w?.task2_answer ?? s.writing_task2) ?? '',
      writing_task1_words: w?.task1_words ?? null,
      writing_task2_words: w?.task2_words ?? null,
      writing_submitted_at: w?.submitted_at ?? null,
      status: s.status,
      submitted_at: s.submitted_at ?? null,
    }
  })

  // Enrich resigned bookings (no submission → empty answers, status='resigned')
  const enrichedResigned = pureResignedBookings.map((b: any) => {
    const profile = profileMap[b.user_id] ?? {}
    const bookingContact = bookingContactMap[b.id] ?? {}
    const userPhone = paymentPhoneMap[b.user_id] || bookingContact.user_phone || profile.phone || ''
    const userName = bookingContact.user_name || profile.full_name || 'Noma\'lum'
    return {
      id: `resigned-${b.id}`,
      user_id: b.user_id,
      booking_id: b.id,
      user_name: userName,
      user_email: profile.email ?? b.user_id,
      user_phone: userPhone,
      is_premium: profile.is_premium ?? false,
      schedule_date: schedule?.date ?? null,
      schedule_time: schedule?.time_slot ?? null,
      listening_answers: {},
      reading_answers: {},
      writing_task1: '',
      writing_task2: '',
      status: 'resigned',
      submitted_at: null,
    }
  })

  // Orphan Writing rows -- candidateIds that showed up in
  // mock_writing_submissions but never wrote a mock_test_submissions
  // row (typical for CDI HTML candidates who exit after Writing).
  // We surface them as their own cards so the admin can still grade
  // Writing standalone. Listening/Reading stay empty.
  const submissionUserIdSet = new Set(submissions.map((s: any) => s.user_id))
  const orphanWritingRows = writingRows.filter(w => !submissionUserIdSet.has(w.user_id))
  const enrichedOrphanWriting = orphanWritingRows.map((w) => {
    // profileMap keys are UUIDs; a candidateId string won't match. Fall
    // back to the candidateId itself as both display name and email so
    // the admin can identify who submitted.
    const profile = profileMap[w.user_id] ?? {}
    return {
      id: `writing-${w.id}`,
      user_id: w.user_id,
      booking_id: null,
      user_name: profile.full_name ?? w.user_id,
      user_email: profile.email ?? w.user_id,
      user_phone: paymentPhoneMap[w.user_id] || profile.phone || '',
      is_premium: profile.is_premium ?? false,
      schedule_date: schedule?.date ?? null,
      schedule_time: schedule?.time_slot ?? null,
      listening_answers: {},
      reading_answers: {},
      writing_task1: w.task1_answer ?? '',
      writing_task2: w.task2_answer ?? '',
      writing_task1_words: w.task1_words ?? null,
      writing_task2_words: w.task2_words ?? null,
      writing_submitted_at: w.submitted_at ?? null,
      status: 'writing_only',
      submitted_at: w.submitted_at ?? null,
    }
  })

  return NextResponse.json([...enrichedSubmissions, ...enrichedOrphanWriting, ...enrichedResigned])
}

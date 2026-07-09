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

  // Fetch submissions AND resigned bookings in parallel
  const [submissionsRes, resignedRes, scheduleRes] = await Promise.all([
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
  ])

  const submissions = submissionsRes.data ?? []
  const resignedBookings = resignedRes.data ?? []
  const schedule = scheduleRes.data

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

  // Fetch profiles + bookings (for payment_ref → phone) in parallel
  const [profilesRes, bookingsForPhoneRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, phone, is_premium')
      .in('id', allUserIds),
    allBookingIds.length > 0
      ? admin
          .from('mock_bookings')
          .select('id, user_id, payment_ref')
          .in('id', allBookingIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

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

  // Enrich submissions
  const enrichedSubmissions = submissions.map((s: any) => {
    const profile = profileMap[s.user_id] ?? {}
    // Phone priority: payment_requests → profiles.phone → ''
    const userPhone = paymentPhoneMap[s.user_id] || profile.phone || ''
    return {
      id: s.id,
      user_id: s.user_id,
      booking_id: s.booking_id,
      user_name: profile.full_name ?? 'Noma\'lum',
      user_email: profile.email ?? s.user_id,
      user_phone: userPhone,
      is_premium: profile.is_premium ?? false,
      schedule_date: schedule?.date ?? null,
      schedule_time: schedule?.time_slot ?? null,
      listening_answers: s.listening_answers ?? {},
      reading_answers: s.reading_answers ?? {},
      writing_task1: s.writing_task1 ?? '',
      writing_task2: s.writing_task2 ?? '',
      status: s.status,
      submitted_at: s.submitted_at ?? null,
    }
  })

  // Enrich resigned bookings (no submission → empty answers, status='resigned')
  const enrichedResigned = pureResignedBookings.map((b: any) => {
    const profile = profileMap[b.user_id] ?? {}
    const userPhone = paymentPhoneMap[b.user_id] || profile.phone || ''
    return {
      id: `resigned-${b.id}`,
      user_id: b.user_id,
      booking_id: b.id,
      user_name: profile.full_name ?? 'Noma\'lum',
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

  return NextResponse.json([...enrichedSubmissions, ...enrichedResigned])
}

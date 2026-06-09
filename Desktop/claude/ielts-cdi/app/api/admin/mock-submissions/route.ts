import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'abdulxdiymamajonov@gmail.com') {
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

  // Fetch profiles for all users
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, phone, is_premium')
    .in('id', allUserIds)

  const profileMap: Record<string, any> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p
  }

  // Enrich submissions
  const enrichedSubmissions = submissions.map((s: any) => {
    const profile = profileMap[s.user_id] ?? {}
    return {
      id: s.id,
      user_id: s.user_id,
      booking_id: s.booking_id,
      user_name: profile.full_name ?? 'Noma\'lum',
      user_email: profile.email ?? s.user_id,
      user_phone: profile.phone ?? '',
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
    return {
      id: `resigned-${b.id}`,
      user_id: b.user_id,
      booking_id: b.id,
      user_name: profile.full_name ?? 'Noma\'lum',
      user_email: profile.email ?? b.user_id,
      user_phone: profile.phone ?? '',
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

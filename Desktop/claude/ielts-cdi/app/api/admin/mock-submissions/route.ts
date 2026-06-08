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

  // Fetch submissions for this schedule
  const { data: submissions, error: subErr } = await admin
    .from('mock_test_submissions')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('submitted_at', { ascending: true })

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json([])
  }

  // Fetch profiles for all user_ids
  const userIds = [...new Set(submissions.map((s: any) => s.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, phone, is_premium')
    .in('id', userIds)

  const profileMap: Record<string, any> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p
  }

  // Fetch schedule info
  const { data: schedule } = await admin
    .from('mock_schedules')
    .select('date, time_slot')
    .eq('id', scheduleId)
    .single()

  // Enrich submissions
  const enriched = submissions.map((s: any) => {
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
      submitted_at: s.submitted_at,
    }
  })

  return NextResponse.json(enriched)
}

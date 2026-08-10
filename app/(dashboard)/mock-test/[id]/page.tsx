export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { MockTestFlow } from '@/components/mock/MockTestFlow'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MockTestTakePage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the user has a confirmed booking for this schedule and hasn't
  // been disqualified (migration 035). The `disqualified` column is
  // pulled first-class here so a cheating user can't just paste the URL
  // to reopen the test after the client-side violation counter closed
  // it. `.maybeSingle()` on a missing column would still populate the
  // rest of the row, so we tolerate a legacy schema where 035 hasn't
  // run yet by falling back to the mock_test_submissions check below.
  const bookingRes = await supabase
    .from('mock_bookings')
    .select('id, status, disqualified')
    .eq('user_id', user.id)
    .eq('schedule_id', id)
    .maybeSingle()
  const booking = bookingRes.data as { id: string; status: string; disqualified?: boolean | null } | null

  if (!booking || booking.status !== 'confirmed') {
    redirect('/mock-test')
  }
  if (booking.disqualified === true) {
    redirect('/mock-test')
  }

  // Load the schedule details + check for existing disqualified submission
  const admin = createAdminClient()

  // Legacy safety net: pre-035 rows carry disqualified status on the
  // submissions row instead of the booking. Keep the redirect for
  // those too.
  const { data: existingSub } = await admin
    .from('mock_test_submissions')
    .select('status')
    .eq('user_id', user.id)
    .eq('schedule_id', id)
    .maybeSingle()

  if (existingSub?.status === 'disqualified') {
    redirect('/mock-test')
  }
  const { data: rawSchedule, error } = await admin
    .from('mock_schedules')
    // Matches the MockSchedule shape MockTestFlow consumes below.
    .select('id, date, time, status, reading_file_url, listening_file_url, writing_task1_image_url, writing_task1_topic, writing_task2_topic')
    .eq('id', id)
    .single()

  if (error || !rawSchedule) notFound()

  const schedule = rawSchedule as {
    id: string
    date: string
    time: string
    status: string
    reading_file_url: string | null
    listening_file_url: string | null
    writing_task1_image_url: string | null
    writing_task1_topic: string | null
    writing_task2_topic: string | null
  }

  // NOTE: We intentionally do NOT enforce the time window here on the server.
  // The schedule date/time in the DB is in local (Uzbekistan, UTC+5) time, but
  // Vercel runs in UTC — parsing "09:00" without timezone info would give a
  // 5-hour discrepancy, causing legitimate users to be redirected.
  // The client (MockTestClient) already gates the "Start" button by local time,
  // and booking.status === 'confirmed' is the real auth gate.

  return <MockTestFlow schedule={schedule} />
}

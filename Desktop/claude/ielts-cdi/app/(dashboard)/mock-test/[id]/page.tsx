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

  // Verify the user has a confirmed booking for this schedule
  const { data: booking } = await supabase
    .from('mock_bookings')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('schedule_id', id)
    .maybeSingle()

  if (!booking || booking.status !== 'confirmed') {
    redirect('/mock-test')
  }

  // Load the schedule details (admin client to bypass RLS on mock_schedules)
  const admin = createAdminClient()
  const { data: rawSchedule, error } = await admin
    .from('mock_schedules')
    .select('*')
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

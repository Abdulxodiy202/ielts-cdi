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

  // Check test time window: 30 min before → 4 hours after
  const testStart   = new Date(`${schedule.date}T${schedule.time}`)
  const now         = new Date()
  const windowStart = new Date(testStart.getTime() - 30 * 60 * 1000)
  const windowEnd   = new Date(testStart.getTime() + 4 * 60 * 60 * 1000)

  if (now < windowStart || now > windowEnd) {
    redirect('/mock-test')
  }

  return <MockTestFlow schedule={schedule} />
}

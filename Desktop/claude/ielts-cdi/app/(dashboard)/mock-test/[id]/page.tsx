export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { MockTakeClient } from '@/components/mock/MockTakeClient'

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
    .select('status')
    .eq('user_id', user.id)
    .eq('schedule_id', id)
    .maybeSingle()

  if (!booking || booking.status !== 'confirmed') {
    redirect('/mock-test')
  }

  // Load the schedule details (admin client to bypass RLS on mock_schedules)
  const admin = createAdminClient()
  const { data: schedule } = await admin
    .from('mock_schedules')
    .select('*')
    .eq('id', id)
    .single()

  if (!schedule) notFound()

  return <MockTakeClient schedule={schedule} />
}

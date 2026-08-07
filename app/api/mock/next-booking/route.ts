export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/next-booking
 *  Returns the user's next upcoming confirmed mock booking + schedule.
 *  Returns null if no booking, or if the test has already been submitted
 *  (so the sidebar countdown card disappears after submission).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json(null)

  // Get all confirmed bookings with a schedule_id
  const { data: bookings } = await supabase
    .from('mock_bookings')
    .select('id, schedule_id, status, booking_date, time_slot')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .not('schedule_id', 'is', null)

  if (!bookings?.length) return Response.json(null)

  const scheduleIds = bookings.map(b => b.schedule_id!)
  const today = new Date().toISOString().split('T')[0]

  const admin = createAdminClient()

  // Get the nearest upcoming schedule
  const { data: schedules } = await admin
    .from('mock_schedules')
    .select('*')
    .in('id', scheduleIds)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(1)

  if (!schedules?.length) return Response.json(null)

  const schedule = schedules[0]
  const booking  = bookings.find(b => b.schedule_id === schedule.id)

  // Check if the user already submitted this test — if so, hide the sidebar card
  const { data: submission } = await supabase
    .from('mock_test_submissions')
    .select('id')
    .eq('user_id', user.id)
    .eq('schedule_id', schedule.id)
    .eq('status', 'submitted')
    .maybeSingle()

  if (submission) return Response.json(null)

  return Response.json({ schedule, booking })
}

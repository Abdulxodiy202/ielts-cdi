export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/next-booking
 *  Returns the user's next upcoming confirmed mock booking, enriched with
 *  the schedule details. Used by the Sidebar countdown.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json(null)

  // Get all confirmed bookings that have a schedule_id
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
  const booking = bookings.find(b => b.schedule_id === schedule.id)

  return Response.json({ schedule, booking })
}

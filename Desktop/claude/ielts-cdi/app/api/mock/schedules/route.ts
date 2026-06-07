export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/schedules
 *  Returns upcoming mock_schedules (date >= today) enriched with the
 *  calling user's booking status for each schedule.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Upcoming schedules (all – admin controls what's "available")
  const { data: schedules, error } = await admin
    .from('mock_schedules')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!schedules?.length) return Response.json([])

  // User's bookings for these specific schedules
  const ids = schedules.map(s => s.id)
  const { data: bookings } = await supabase
    .from('mock_bookings')
    .select('schedule_id, status, payment_status')
    .eq('user_id', user.id)
    .in('schedule_id', ids)

  const bookingMap: Record<string, { status: string; payment_status: string }> =
    Object.fromEntries((bookings ?? []).map(b => [b.schedule_id, b]))

  return Response.json(
    schedules.map(s => ({ ...s, userBooking: bookingMap[s.id] ?? null }))
  )
}

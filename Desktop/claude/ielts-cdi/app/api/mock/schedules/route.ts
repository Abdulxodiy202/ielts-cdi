export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/schedules
 *  Returns upcoming mock_schedules enriched with:
 *  - userBooking: { status, payment_status } | null
 *  - isSubmitted: true if the user has a 'submitted' entry in mock_test_submissions
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Upcoming schedules
  const { data: schedules, error } = await admin
    .from('mock_schedules')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!schedules?.length) return Response.json([])

  const ids = schedules.map(s => s.id)

  // Fetch bookings and submissions in parallel
  const [bookingsRes, submissionsRes] = await Promise.all([
    supabase
      .from('mock_bookings')
      .select('schedule_id, status, payment_status')
      .eq('user_id', user.id)
      .in('schedule_id', ids),
    supabase
      .from('mock_test_submissions')
      .select('schedule_id, status')
      .eq('user_id', user.id)
      .in('schedule_id', ids)
      .eq('status', 'submitted'),
  ])

  const bookingMap: Record<string, { status: string; payment_status: string }> =
    Object.fromEntries((bookingsRes.data ?? []).map(b => [b.schedule_id, b]))

  const submittedSet = new Set(
    (submissionsRes.data ?? []).map(s => s.schedule_id)
  )

  return Response.json(
    schedules.map(s => ({
      ...s,
      userBooking:  bookingMap[s.id]    ?? null,
      isSubmitted:  submittedSet.has(s.id),
    }))
  )
}

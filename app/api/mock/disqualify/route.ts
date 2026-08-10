export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/mock/disqualify
 * Called when a user is disqualified for cheating (3 violations).
 * Body: { schedule_id }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let schedule_id: string | undefined
  try {
    const body = await request.json()
    schedule_id = body.schedule_id
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!schedule_id) {
    return Response.json({ error: 'schedule_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Two writes in parallel:
  //   1. Booking row → disqualified=true (migration 035). This is the
  //      sticky bit the user-facing MockTestClient reads to show the
  //      "You've been disqualified" banner and hide the Book button
  //      for this schedule forever.
  //   2. Submission row → status='disqualified' (existing behaviour;
  //      the admin panel filters submissions by status).
  // If either fails independently we still return ok so the client's
  // "test cancelled" flow doesn't get stuck retrying — logs surface
  // the problem for us instead.
  try {
    const [bookingRes, subRes] = await Promise.all([
      admin
        .from('mock_bookings')
        .update({
          disqualified: true,
          disqualified_at: new Date().toISOString(),
          disqualified_reason: 'cheating_3_violations',
          status: 'cancelled',
        })
        .eq('user_id', user.id)
        .eq('schedule_id', schedule_id)
        .select(),
      admin
        .from('mock_test_submissions')
        .update({ status: 'disqualified', submitted_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('schedule_id', schedule_id),
    ])
    console.log('[mock/disqualify] booking update:', bookingRes.error ?? `rows=${bookingRes.data?.length ?? 0}`)
    console.log('[mock/disqualify] submission update:', subRes.error ?? 'ok')
  } catch (err) {
    console.error('[mock/disqualify] update error:', err)
  }

  return Response.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/mock/resign
 * Called when a user failed to enter the test within 5 minutes of start.
 * Body: { bookingId: string, reason?: string }
 *
 * Security: verifies the booking belongs to the authenticated user before updating.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let bookingId: string | undefined
  let reason: string = 'Vaqtida kirmadi'

  try {
    const body = await request.json()
    bookingId = body.bookingId
    if (body.reason) reason = body.reason
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!bookingId) {
    return Response.json({ error: 'bookingId required' }, { status: 400 })
  }

  // Verify the booking belongs to this user and is confirmed
  const { data: booking } = await supabase
    .from('mock_bookings')
    .select('id, status, user_id')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!booking) {
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only resign confirmed bookings (idempotent — skip if already resigned)
  if (booking.status === 'resigned') {
    return Response.json({ ok: true, alreadyResigned: true })
  }

  if (booking.status !== 'confirmed') {
    return Response.json({ error: 'Can only resign confirmed bookings' }, { status: 409 })
  }

  const admin = createAdminClient()

  // Try with resign_reason column first; fall back to just status if column missing
  const { error } = await admin
    .from('mock_bookings')
    .update({ status: 'resigned', resign_reason: reason })
    .eq('id', bookingId)

  if (error) {
    // Retry without resign_reason (column may not exist yet)
    const { error: err2 } = await admin
      .from('mock_bookings')
      .update({ status: 'resigned' })
      .eq('id', bookingId)

    if (err2) {
      console.error('[mock/resign] update error:', err2)
      return Response.json({ error: err2.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}

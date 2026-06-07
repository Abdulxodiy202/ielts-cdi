export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/mock/schedules/[id]
 *  Returns the full schedule (including file URLs and writing topics).
 *  Only accessible if the calling user has a confirmed booking for it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Must have a confirmed booking
  const { data: booking } = await supabase
    .from('mock_bookings')
    .select('status')
    .eq('user_id', user.id)
    .eq('schedule_id', id)
    .maybeSingle()

  if (!booking || booking.status !== 'confirmed') {
    return Response.json({ error: 'Access denied' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: schedule, error } = await admin
    .from('mock_schedules')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !schedule) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(schedule)
}

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

  // Mark existing submission as 'disqualified' — admin panel shows this status
  try {
    const admin = createAdminClient()
    await admin
      .from('mock_test_submissions')
      .update({ status: 'disqualified', submitted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('schedule_id', schedule_id)
  } catch (err) {
    console.error('[mock/disqualify] update submission error:', err)
  }

  return Response.json({ ok: true })
}

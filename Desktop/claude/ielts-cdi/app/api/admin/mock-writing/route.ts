export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'maxmudovamashxura71@gmail.com'

/** GET /api/admin/mock-writing?scheduleId=xxx
 *  Returns all writing answers submitted for a specific schedule.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scheduleId = new URL(req.url).searchParams.get('scheduleId')
  if (!scheduleId) return Response.json([])

  const admin = createAdminClient()

  // Answers with user profile info
  const { data: answers, error } = await admin
    .from('mock_writing_answers')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('submitted_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!answers?.length) return Response.json([])

  // Enrich with profile names/emails
  const userIds = answers.map(a => a.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  return Response.json(
    answers.map(a => ({
      ...a,
      user_name: profileMap[a.user_id]?.full_name ?? 'N/A',
      user_email: profileMap[a.user_id]?.email ?? 'N/A',
    }))
  )
}

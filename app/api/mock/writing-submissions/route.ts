export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/mock/writing-submissions
 *
 * New pipeline for the CDI-HTML Writing iframe. The uploaded HTML file
 * postMessages
 *   { type: 'CDI_SUBMIT', testType: 'writing',
 *     task1, task2, task1Words, task2Words, scheduleId, userId }
 * and the MockTestFlow WritingSection forwards that payload here.
 *
 * We write into `mock_writing_submissions` (user_id TEXT, schedule_id
 * UUID, task1_answer, task2_answer, task1_words, task2_words,
 * submitted_at) using the service-role admin client so a candidate
 * user_id string (e.g. "CDI-123456") that doesn't map to auth.users
 * still lands. The caller must be authenticated though -- that gate
 * prevents anonymous writes and lets us default user_id to auth.uid
 * when the iframe didn't supply one.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    scheduleId?: unknown
    schedule_id?: unknown
    task1?: unknown
    task2?: unknown
    task1Words?: unknown
    task2Words?: unknown
  }

  // Accept both camelCase (iframe payload) and snake_case (server code)
  // key spellings so the same route works from either caller shape.
  const scheduleId = (body.scheduleId ?? body.schedule_id) as string | undefined
  if (!scheduleId || typeof scheduleId !== 'string') {
    return Response.json({ error: 'scheduleId required' }, { status: 400 })
  }
  // ROOT CAUSE FIX: the uploaded CDI Writing HTML is only ever loaded
  // inside this app's authenticated MockTestFlow iframe -- there is no
  // real standalone-candidate scenario here, so trusting a client-
  // supplied userId is both unnecessary and actively harmful: the
  // HTML's own login gate is disabled and MockTestFlow never sends it
  // a CDI_INIT with the real user id, so it falls back to a throwaway
  // 'CDI-<timestamp>' string. That string doesn't match the real
  // auth UUID that mock_test_submissions.user_id uses, so the admin
  // panel's writingByUserId lookup (keyed on the real UUID) never
  // finds this row and shows the Writing task as empty even though it
  // saved successfully under the wrong user_id.
  // Always trust the authenticated session instead -- it's already
  // required (401 above) and it's what every other submission table
  // keys on, so this is also what actually links the row to the
  // student in the admin view.
  const userId = user.id

  const task1 = typeof body.task1 === 'string' ? body.task1 : ''
  const task2 = typeof body.task2 === 'string' ? body.task2 : ''
  // The iframe already computes word counts, but recompute defensively
  // so the DB row stays consistent even if only text arrives.
  const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
  const task1Words = typeof body.task1Words === 'number' ? body.task1Words : wc(task1)
  const task2Words = typeof body.task2Words === 'number' ? body.task2Words : wc(task2)

  // Service-role client bypasses RLS -- required because the CDI flow
  // may write with a candidate user_id that isn't auth.uid.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mock_writing_submissions')
    .upsert(
      {
        user_id: userId,
        schedule_id: scheduleId,
        task1_answer: task1,
        task2_answer: task2,
        task1_words: task1Words,
        task2_words: task2Words,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,schedule_id' },
    )
    .select('id, user_id, schedule_id, task1_words, task2_words, submitted_at')
    .maybeSingle()

  if (error) {
    console.error('[mock/writing-submissions] upsert failed:', error.message, error.code)
    return Response.json({ error: error.message, code: error.code }, { status: 500 })
  }
  return Response.json({ ok: true, submission: data })
}

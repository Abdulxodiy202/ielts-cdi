export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-config'

// GET/PUT the admin's free-text instruction for how the AI should build
// each user's study plan. Single row keyed id='default' in ai_settings.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_settings')
    .select('study_plan_prompt, updated_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ study_plan_prompt: data?.study_plan_prompt ?? '' })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const prompt = typeof (body as { study_plan_prompt?: unknown })?.study_plan_prompt === 'string'
    ? (body as { study_plan_prompt: string }).study_plan_prompt
    : null
  if (prompt === null) {
    return Response.json({ error: 'study_plan_prompt talab qilinadi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ai_settings')
    .upsert({ id: 'default', study_plan_prompt: prompt, updated_at: new Date().toISOString() })

  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

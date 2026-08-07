export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskType: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskType } = await params
  if (taskType !== 'task1' && taskType !== 'task2') {
    return Response.json({ error: 'Invalid task type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('typing_essays')
    .select('id, title, content, word_count')
    .eq('task_type', taskType)
    .eq('is_active', true)
    .order('id', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return Response.json({ error: 'no_essays_available' }, { status: 404 })
  }

  return Response.json({ essays: data })
}

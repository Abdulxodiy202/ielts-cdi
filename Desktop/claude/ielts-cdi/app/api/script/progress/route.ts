export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { script_id, accuracy, stars, is_completed, last_answer } = await request.json()
  if (script_id === undefined || script_id === null || typeof accuracy !== 'number') {
    return Response.json({ error: 'script_id va accuracy kerak' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('script_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('script_id', script_id)
    .maybeSingle()

  if (!existing) {
    const { data, error } = await supabase
      .from('script_progress')
      .insert({
        user_id: user.id,
        script_id,
        best_accuracy: accuracy,
        best_stars: stars ?? 0,
        is_completed: Boolean(is_completed),
        attempts: 1,
        last_answer: last_answer ?? null,
      })
      .select('*')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data, { status: 201 })
  }

  const { data, error } = await supabase
    .from('script_progress')
    .update({
      attempts: existing.attempts + 1,
      best_accuracy: Math.max(existing.best_accuracy, accuracy),
      best_stars: Math.max(existing.best_stars ?? 0, stars ?? 0),
      is_completed: existing.is_completed || Boolean(is_completed), // never downgrade
      last_answer: last_answer ?? existing.last_answer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

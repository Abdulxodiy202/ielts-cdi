export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function GET(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const levelId = new URL(request.url).searchParams.get('level_id')
  if (!levelId) return Response.json({ error: 'level_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_questions')
    .select('*')
    .eq('level_id', levelId)
    .order('order_index')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { level_id, question, correct_answer, options, hint, order_index } = body

  if (!level_id || !question?.trim() || !correct_answer?.trim() || !Array.isArray(options)) {
    return Response.json({ error: 'level_id, question, correct_answer, options[] required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_questions')
    .insert({
      level_id,
      question: question.trim(),
      correct_answer: correct_answer.trim(),
      options,
      hint: hint?.trim() || null,
      order_index: order_index ?? 0,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

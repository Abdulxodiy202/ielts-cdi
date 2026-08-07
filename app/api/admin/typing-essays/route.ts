export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('typing_essays')
    .select('id, title, content, task_type, is_active, word_count, created_at')
    .order('id', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, content, task_type, is_active } = body

  if (!title || title.trim().length < 3 || title.trim().length > 200) {
    return Response.json({ error: 'Title must be 3-200 characters' }, { status: 400 })
  }
  if (task_type !== 'task1' && task_type !== 'task2') {
    return Response.json({ error: 'task_type must be task1 or task2' }, { status: 400 })
  }
  const words = (content ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 50) {
    return Response.json({ error: 'Content must be at least 50 words' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('typing_essays')
    .insert({
      title: title.trim(),
      content: content.trim(),
      task_type,
      is_active: is_active ?? true,
      word_count: words.length,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

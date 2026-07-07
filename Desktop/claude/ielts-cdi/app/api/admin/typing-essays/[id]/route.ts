export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { title, content, task_type, is_active } = body

  const update: Record<string, unknown> = {}

  if (title !== undefined) {
    if (title.trim().length < 3 || title.trim().length > 200) {
      return Response.json({ error: 'Title must be 3-200 characters' }, { status: 400 })
    }
    update.title = title.trim()
  }
  if (task_type !== undefined) {
    if (task_type !== 'task1' && task_type !== 'task2') {
      return Response.json({ error: 'task_type must be task1 or task2' }, { status: 400 })
    }
    update.task_type = task_type
  }
  if (content !== undefined) {
    const words = content.trim().split(/\s+/).filter(Boolean)
    if (words.length < 50) {
      return Response.json({ error: 'Content must be at least 50 words' }, { status: 400 })
    }
    update.content = content.trim()
    update.word_count = words.length
  }
  if (is_active !== undefined) update.is_active = is_active

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('typing_essays')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('typing_essays').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

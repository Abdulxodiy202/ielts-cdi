import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('articles')
      .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, created_at')
      .eq('is_published', true)
      .order('order_index', { ascending: true })

    if (error) {
      console.log('[articles GET] error:', error.code, error.message)
      return NextResponse.json([], { status: 200 })
    }
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    console.log('[articles GET] catch:', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, is_premium } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: maxRow } = await admin
    .from('articles')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = ((maxRow?.order_index as number | null) ?? 0) + 1

  const { data, error } = await admin
    .from('articles')
    .insert({
      title: title.trim(),
      is_premium: is_premium ?? false,
      is_published: true,
      order_index: nextIndex,
    })
    .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, created_at')
    .single()

  if (error) {
    console.log('[articles POST] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

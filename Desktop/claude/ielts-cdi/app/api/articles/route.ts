import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('articles')
      .select('id, title, description, category, level, read_time, is_premium, cover_image, word_count, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

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

  const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const userEmail = authUser?.email
  if (userEmail !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, content, category, level, read_time, is_premium, is_published } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      content: content?.trim() || null,
      category: category || 'general',
      level: level || 'intermediate',
      read_time: read_time || 5,
      is_premium: is_premium ?? false,
      is_published: is_published ?? true,
      word_count: content ? content.trim().split(/\s+/).length : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

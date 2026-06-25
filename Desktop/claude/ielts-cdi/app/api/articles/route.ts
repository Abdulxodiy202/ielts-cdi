import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('articles')
      .select('id, title, file_url, cover_image_url, is_premium, is_published, created_at')
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
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, is_premium } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .insert({
      title: title.trim(),
      is_premium: is_premium ?? false,
      is_published: true,
    })
    .select('id, title, file_url, is_premium, is_published, created_at')
    .single()

  if (error) {
    console.log('[articles POST] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ...data, cover_image_url: null }, { status: 201 })
}

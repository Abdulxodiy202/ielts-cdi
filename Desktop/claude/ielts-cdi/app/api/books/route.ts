import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'
import { isBookCategory, DEFAULT_BOOK_CATEGORY } from '@/lib/utils/bookCategories'

const SELECT = 'id, title, author, heyzine_url, cover_image_url, recommendation, category, is_premium, is_published, created_at'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const category = req.nextUrl.searchParams.get('category')

    const admin = createAdminClient()
    let query = admin
      .from('books')
      .select(SELECT)
      .eq('is_published', true)
    if (category && isBookCategory(category)) {
      query = query.eq('category', category)
    }
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.log('[books GET] error:', error.code, error.message)
      return NextResponse.json([], { status: 200 })
    }
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    console.log('[books GET] catch:', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, author, heyzine_url, is_premium, category } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!heyzine_url?.trim()) return NextResponse.json({ error: 'Heyzine URL required' }, { status: 400 })
  if (category !== undefined && !isBookCategory(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('books')
    .insert({
      title: title.trim(),
      author: author?.trim() || null,
      heyzine_url: heyzine_url.trim(),
      is_premium: is_premium ?? false,
      is_published: true,
      category: category ?? DEFAULT_BOOK_CATEGORY,
    })
    .select(SELECT)
    .single()

  if (error) {
    console.log('[books POST] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

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
    // Featured card'ida description bo'sh bo'lsa content'dan excerpt
    // yasab ko'rsatamiz -- shuning uchun content ham select'ga qo'shildi.
    // source_* ustunlari ro'yxatda kerak emas -- ular faqat article
    // reader'da attribution uchun ishlatiladi.
    const { data, error } = await admin
      .from('articles')
      .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, difficulty, category, read_time, description, content, has_test, created_at')
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
  const {
    title, is_premium, order_index,
    category, difficulty, read_time, description, content,
    source_text, source_url,
  } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const admin = createAdminClient()

  let nextIndex: number
  if (typeof order_index === 'number' && order_index > 0) {
    nextIndex = order_index
  } else {
    const { data: maxRow } = await admin
      .from('articles')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .single()
    nextIndex = ((maxRow?.order_index as number | null) ?? 0) + 1
  }

  const insertRow: Record<string, unknown> = {
    title: title.trim(),
    is_premium: is_premium ?? false,
    is_published: true,
    order_index: nextIndex,
  }
  // Yangi crackd-uslub formadan kelgan ixtiyoriy maydonlar. Validation
  // faqat CHECK constraint darajasida -- noto'g'ri qiymat DB'dan xato
  // qaytaradi va POST 500 bilan tushadi.
  if (category !== undefined) insertRow.category = category || null
  if (difficulty !== undefined) insertRow.difficulty = difficulty || null
  if (read_time !== undefined) insertRow.read_time = Number(read_time) || null
  if (description !== undefined) insertRow.description = description || null
  if (content !== undefined) insertRow.content = content || null
  if (source_text !== undefined) insertRow.source_text = source_text || null
  if (source_url !== undefined) insertRow.source_url = source_url || null

  const { data, error } = await admin
    .from('articles')
    .insert(insertRow)
    .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, difficulty, category, read_time, description, content, source_text, source_url, has_test, created_at')
    .single()

  if (error) {
    console.log('[articles POST] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

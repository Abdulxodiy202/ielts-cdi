export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

// Admin panel "Sayt rasmlari" bo'limi: barcha (nashr etilgan va
// etilmagan) rasmlarni ko'radi, farqli o'laroq kirish sahifasi faqat
// is_published=true bo'lganlarni RLS orqali ko'radi.
export async function GET() {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('landing_showcase_images')
    .select('id, title, title_en, image_url, storage_path, order_index, is_published, created_at')
    .order('order_index', { ascending: true })

  if (error) {
    if ((error as { code?: string }).code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    // title_en ustuni hali qo'shilmagan bo'lsa (eski loyihalarda) --
    // migratsiya kerakligini bildiramiz, lekin sahifani butunlay buzmaymiz.
    if ((error as { code?: string }).code === '42703') return Response.json({ error: 'DB_MIGRATION_NEEDED' }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}

// Fayl signed URL orqali storage'ga yuklab bo'lingandan keyin, shu
// yerga DB qatorini yaratish uchun murojaat qilinadi.
export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { title, title_en, image_url, storage_path } = body as { title?: string; title_en?: string; image_url?: string; storage_path?: string }

  if (!image_url || !storage_path) {
    return Response.json({ error: 'image_url va storage_path kerak' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Yangi rasm ro'yxat OXIRIGA tushsin.
  const { data: maxRow } = await admin
    .from('landing_showcase_images')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.order_index ?? -1) + 1

  const { data, error } = await admin
    .from('landing_showcase_images')
    .insert({
      title: title?.trim() || null,
      title_en: title_en?.trim() || null,
      image_url,
      storage_path,
      order_index: nextOrder,
      is_published: true,
    })
    .select('id, title, title_en, image_url, storage_path, order_index, is_published, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

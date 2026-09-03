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

// Playlist ichidagi videolarni admin panelidagi "yuqoriga/pastga
// surish" tugmalari bilan qayta tartiblashda ishlatiladi. Avval buni
// klient tomonda har bir video uchun ALOHIDA PATCH so'rovi (parallel,
// ba'zida 30+ ta birdaniga) bilan qilar edik -- bu Vercel/Supabase'da
// vaqti-vaqti bilan qisman muvaffaqiyatsiz bo'lib (xatolik jim
// yutilib), ba'zi videolarning order_in_playlist qiymati bazada
// yangilanmay qolishiga olib kelardi, garchi admin ekranida hammasi
// "muvaffaqiyatli" ko'ringan bo'lsa ham. Endi hammasi BITTA so'rovda,
// natijalar tekshirilib, xatolik bo'lsa aniq qaytariladi.
export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) return Response.json({ error: "items bo'sh" }, { status: 400 })

  const admin = createAdminClient()
  const results = await Promise.all(
    items.map((it: { id?: string; order_in_playlist?: number }) => {
      if (!it || typeof it.id !== 'string' || !Number.isFinite(it.order_in_playlist)) {
        return Promise.resolve({ error: { message: "Noto'g'ri item" } })
      }
      return admin.from('video_lessons').update({ order_in_playlist: it.order_in_playlist }).eq('id', it.id)
    })
  )

  const failed = results.filter(r => r && (r as { error?: unknown }).error)
  if (failed.length > 0) {
    const first = failed[0] as { error?: { message?: string } }
    return Response.json({ error: first.error?.message ?? 'Xatolik', failedCount: failed.length }, { status: 500 })
  }

  return Response.json({ ok: true, updated: items.length })
}

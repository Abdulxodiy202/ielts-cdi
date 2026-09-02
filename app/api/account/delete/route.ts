export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/account/delete — foydalanuvchi o'z hisobini butunlay
// o'chiradi. Avval sababni (va ixtiyoriy izohni) account_deletions
// jadvaliga yozib qo'yamiz (admin panelda ko'rish uchun), FAQAT SHUNDAN
// KEYIN haqiqiy auth.users qatorini SERVICE ROLE orqali o'chiramiz --
// bu profiles (va ON DELETE CASCADE FK'ga ega boshqa jadvallarni) ham
// avtomatik tozalaydi. Tartib muhim: o'chirish muvaffaqiyatsiz bo'lsa
// ham sabab-yozuvi allaqachon saqlangan bo'ladi (ma'lumot yo'qolmaydi).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { reason, detail } = body as { reason?: string; detail?: string }
  if (!reason?.trim()) {
    return Response.json({ error: "Sabab tanlanishi shart" }, { status: 400 })
  }

  const admin = createAdminClient()

  // O'chirishdan OLDIN ism/emailni saqlab qolamiz -- auth.users
  // o'chirilgach bu ma'lumot boshqa hech qayerdan olinmaydi.
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()
  const p = profile as { full_name?: string | null; display_name?: string | null } | null
  const userName = p?.display_name || p?.full_name || null

  const { error: insertError } = await admin.from('account_deletions').insert({
    user_id: user.id,
    user_email: user.email ?? null,
    user_name: userName,
    reason: reason.trim(),
    detail: detail?.trim() || null,
  })
  // account_deletions jadvali hali SQL orqali yaratilmagan bo'lishi
  // mumkin (eski o'rnatishlarda) -- bu holatda ham foydalanuvchi
  // hisobini o'chira olishi kerak, faqat sabab-yozuvi saqlanmaydi.
  if (insertError && insertError.code !== '42P01') {
    console.error('[account/delete] account_deletions insert failed:', insertError.message)
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

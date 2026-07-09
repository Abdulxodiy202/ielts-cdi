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

export async function GET() {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  // Fetch promo codes
  const { data: codes, error: codesError } = await admin
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (codesError) {
    const code = (codesError as any).code
    if (code === '42P01' || codesError.message?.includes('does not exist')) {
      return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    }
    return Response.json({ error: codesError.message }, { status: 500 })
  }

  // Fetch usage rows
  const { data: usageRaw } = await admin
    .from('promo_code_usage')
    .select('id, promo_code_id, user_id, used_at')
    .order('used_at', { ascending: false })

  const usageRows = usageRaw ?? []

  // Fetch profiles for users who have usage rows
  const userIds = [...new Set(usageRows.map(u => u.user_id).filter(Boolean))]
  const { data: profileRows } = userIds.length
    ? await admin.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null; email: string; phone: string | null }[] }

  // Also fetch profiles for assigned_user_id and used_by
  const extraIds = [
    ...(codes ?? []).map(c => c.assigned_user_id).filter(Boolean),
    ...(codes ?? []).map(c => c.used_by).filter(Boolean),
  ]
  const extraUniqueIds = [...new Set(extraIds)].filter(id => !userIds.includes(id))
  const { data: extraProfileRows } = extraUniqueIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', extraUniqueIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] }

  // Fetch payment_requests that used a promo code
  const codeTexts = (codes ?? []).map(c => c.code)
  const { data: paymentRows } = codeTexts.length
    ? await admin
        .from('payment_requests')
        .select('user_id, promo_code, amount, original_amount')
        .in('promo_code', codeTexts)
    : { data: [] as { user_id: string; promo_code: string; amount: number; original_amount: number | null }[] }

  const profileMap = Object.fromEntries([
    ...(profileRows ?? []).map(p => [p.id, p]),
    ...(extraProfileRows ?? []).map(p => [p.id, p]),
  ])

  // Attach enriched usage and assigned/used info to each code
  const result = (codes ?? []).map(c => {
    const assignedProfile = c.assigned_user_id ? (profileMap[c.assigned_user_id] ?? null) : null
    const usedByProfile = c.used_by ? (profileMap[c.used_by] ?? null) : null
    return {
      ...c,
      assigned_user_email: (assignedProfile as any)?.email ?? null,
      used_by_email: (usedByProfile as any)?.email ?? null,
      usage: usageRows
        .filter(u => u.promo_code_id === c.id)
        .map(u => {
          const profile = profileMap[u.user_id] ?? {}
          const payment = (paymentRows ?? []).find(p => p.user_id === u.user_id && p.promo_code === c.code)
          return {
            id: u.id,
            user_id: u.user_id,
            user_name: (profile as any).full_name ?? null,
            user_email: (profile as any).email ?? null,
            user_phone: (profile as any).phone ?? null,
            original_amount: payment?.original_amount ?? null,
            discounted_amount: payment?.amount ?? null,
            used_at: u.used_at,
          }
        }),
    }
  })

  return Response.json(result)
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { code, discount_percent, valid_from, valid_until, usage_type, assigned_user_id } = body

  if (!code?.trim()) return Response.json({ error: 'Kod kiritilishi shart' }, { status: 400 })
  if (!discount_percent || discount_percent < 1 || discount_percent > 100)
    return Response.json({ error: "Chegirma 1-100 oralig'ida bo'lishi kerak" }, { status: 400 })
  if (!valid_from || !valid_until)
    return Response.json({ error: 'Sanalar kiritilishi shart' }, { status: 400 })

  const admin = createAdminClient()
  const insertData: Record<string, unknown> = {
    code: code.trim().toUpperCase(),
    discount_percent,
    valid_from,
    valid_until,
    usage_type: usage_type || 'unlimited',
  }
  if (assigned_user_id) insertData.assigned_user_id = assigned_user_id

  const { data, error } = await admin
    .from('promo_codes')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Bu kod allaqachon mavjud' : error.message
    return Response.json({ error: msg }, { status: 400 })
  }
  return Response.json(data, { status: 201 })
}

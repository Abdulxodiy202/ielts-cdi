export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

interface PaymentItem {
  id: string
  amount: number
  status: string
  type: string
  created_at: string
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Email lookup mode: GET /api/admin/users?email=xxx
  const { searchParams } = new URL(request.url)
  const emailQuery = searchParams.get('email')?.trim()
  if (emailQuery) {
    const { data: profileRows } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .ilike('email', emailQuery)
      .limit(1)
    const profile = profileRows?.[0]
    if (!profile) {
      return NextResponse.json({ error: "Bunday email ro'yxatdan o'tmagan" }, { status: 404 })
    }
    return NextResponse.json({ id: profile.id, email: profile.email, full_name: profile.full_name })
  }

  // All three fetches in parallel
  const [authRes, profilesRes, paymentsRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, full_name, is_premium, premium_until'),
    admin.from('payment_requests')
      .select('id, user_id, amount, status, type, created_at')
      .order('created_at', { ascending: false }),
  ])

  if (authRes.error) return NextResponse.json({ error: authRes.error.message }, { status: 500 })
  const authUsers = authRes.data?.users ?? []

  // Profile map
  const profileMap: Record<string, { full_name: string | null; is_premium: boolean; premium_until: string | null }> = {}
  for (const p of profilesRes.data ?? []) {
    profileMap[p.id] = {
      full_name: p.full_name ?? null,
      is_premium: p.is_premium ?? false,
      premium_until: p.premium_until ?? null,
    }
  }

  // Payment map: user_id → { count, last_payment_date, items[] }
  const paymentMap: Record<string, { count: number; last_payment_date: string | null; items: PaymentItem[] }> = {}
  for (const p of paymentsRes.data ?? []) {
    if (!paymentMap[p.user_id]) {
      paymentMap[p.user_id] = { count: 0, last_payment_date: null, items: [] }
    }
    paymentMap[p.user_id].count++
    if (!paymentMap[p.user_id].last_payment_date) {
      paymentMap[p.user_id].last_payment_date = p.created_at
    }
    paymentMap[p.user_id].items.push({
      id: p.id,
      amount: p.amount,
      status: p.status,
      type: p.type,
      created_at: p.created_at,
    })
  }

  const result = authUsers.map(u => {
    // Best available display name: profile → user_metadata.full_name → user_metadata.name
    const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
    const profileName = profileMap[u.id]?.full_name
    const full_name = profileName || meta.full_name || meta.name || null

    const pm = paymentMap[u.id]

    return {
      id: u.id,
      email: u.email ?? '',
      full_name,
      is_premium: profileMap[u.id]?.is_premium ?? false,
      premium_until: profileMap[u.id]?.premium_until ?? null,
      payment_count: pm?.count ?? 0,
      last_payment_date: pm?.last_payment_date ?? null,
      payments: pm?.items ?? [],
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }
  })

  result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return NextResponse.json(result)
}

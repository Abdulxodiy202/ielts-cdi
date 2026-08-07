export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'
import { isActivePremium } from '@/lib/utils/premium'

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
  if (!user || !isAdmin(user.email)) {
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

  // All three fetches in parallel. Try the wider column set first so we
  // pick up display_name / username / avatar_url when the migration is
  // applied. On 42703 (undefined_column) fall back to the legacy shape.
  const [authRes, profilesResFull, paymentsRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, full_name, display_name, username, avatar_url, is_premium, premium_until, last_seen_at'),
    admin.from('payment_requests')
      .select('id, user_id, amount, status, type, created_at')
      .order('created_at', { ascending: false }),
  ])

  const profilesRes = profilesResFull.error?.code === '42703'
    ? await admin.from('profiles').select('id, full_name, is_premium, premium_until, last_seen_at')
    : profilesResFull

  if (authRes.error) return NextResponse.json({ error: authRes.error.message }, { status: 500 })
  const authUsers = authRes.data?.users ?? []

  // Profile map
  interface ProfileRow {
    id: string
    full_name?: string | null
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
    is_premium?: boolean | null
    premium_until?: string | null
    last_seen_at?: string | null
  }
  const profileMap: Record<string, {
    full_name: string | null
    display_name: string | null
    username: string | null
    avatar_url: string | null
    is_premium: boolean
    premium_until: string | null
    last_seen_at: string | null
  }> = {}
  for (const p of (profilesRes.data as ProfileRow[] | null) ?? []) {
    profileMap[p.id] = {
      full_name: p.full_name ?? null,
      display_name: p.display_name ?? null,
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
      is_premium: p.is_premium ?? false,
      premium_until: p.premium_until ?? null,
      last_seen_at: p.last_seen_at ?? null,
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
    // Best available display name: profile.display_name → profile.full_name
    // → user_metadata.full_name → user_metadata.name.
    const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
    const pmProfile = profileMap[u.id]
    const full_name = pmProfile?.display_name || pmProfile?.full_name || meta.display_name || meta.full_name || meta.name || null

    const pm = paymentMap[u.id]
    const rawIsPremium = pmProfile?.is_premium ?? false
    const rawPremiumUntil = pmProfile?.premium_until ?? null
    // Authoritative "is this user premium RIGHT NOW" -- shares the exact
    // rule the user-facing sidebar/gates use so admin and dashboard agree.
    const active_premium = isActivePremium({ is_premium: rawIsPremium, premium_until: rawPremiumUntil })
    // Legacy row where is_premium=true but the date is null/past. Admin
    // UI can render a distinct "Premium (expired)" pill for these; for
    // the user themselves they're already treated as free.
    const premium_expired = rawIsPremium && !active_premium

    return {
      id: u.id,
      email: u.email ?? '',
      full_name,
      username: pmProfile?.username ?? null,
      avatar_url: pmProfile?.avatar_url ?? null,
      is_premium: rawIsPremium,
      premium_until: rawPremiumUntil,
      active_premium,
      premium_expired,
      payment_count: pm?.count ?? 0,
      last_payment_date: pm?.last_payment_date ?? null,
      payments: pm?.items ?? [],
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      last_seen_at: pmProfile?.last_seen_at ?? null,
    }
  })

  result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return NextResponse.json(result)
}

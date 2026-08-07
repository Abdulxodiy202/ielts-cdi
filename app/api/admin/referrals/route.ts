export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // All profiles
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, full_name, email, referral_code')
    .order('created_at', { ascending: false })

  if (profErr?.code === '42703') {
    return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  }
  if (profErr) return Response.json({ error: profErr.message }, { status: 500 })

  // All referrals (to count conversions per referrer)
  const { data: referrals, error: rErr } = await admin
    .from('referrals')
    .select('referrer_id, converted_to_premium')

  if (rErr?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  // If referrals table missing but profiles is OK, just return 0 counts
  const allReferrals = rErr ? [] : (referrals ?? [])

  // Build conversion count map
  const conversionMap = new Map<string, number>()
  for (const ref of allReferrals) {
    if (ref.converted_to_premium) {
      conversionMap.set(ref.referrer_id, (conversionMap.get(ref.referrer_id) ?? 0) + 1)
    }
  }

  const stats = (profiles ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    referral_code: p.referral_code,
    converted_count: conversionMap.get(p.id) ?? 0,
  }))

  return Response.json({ stats })
}

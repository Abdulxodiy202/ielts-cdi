export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Get all referrers with stats
  const { data: referrers, error: refErr } = await admin
    .from('profiles')
    .select('id, full_name, email, referral_code')
    .not('referral_code', 'is', null)

  if (refErr?.code === '42P01' || refErr?.code === '42703') {
    return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  }
  if (refErr) return Response.json({ error: refErr.message }, { status: 500 })

  // Get all referrals
  const { data: referrals, error: rErr } = await admin
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })

  if (rErr?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (rErr) return Response.json({ error: rErr.message }, { status: 500 })

  const allReferrals = referrals ?? []

  // Build per-referrer stats
  const stats = (referrers ?? []).map(r => {
    const mine = allReferrals.filter(ref => ref.referrer_id === r.id)
    const converted = mine.filter(ref => ref.converted_to_premium)
    const lastDate = mine.length ? mine[0].created_at : null
    return {
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      referral_code: r.referral_code,
      total_referred: mine.length,
      converted_count: converted.length,
      last_referral_at: lastDate,
    }
  }).filter(r => r.total_referred > 0)
    .sort((a, b) => b.total_referred - a.total_referred)

  return Response.json({ stats, referrals: allReferrals })
}

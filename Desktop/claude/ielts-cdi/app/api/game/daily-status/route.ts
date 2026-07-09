export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'
import { getDailyLimit, getTashkentDate, getNextTashkentMidnightISO } from '@/lib/utils/gameUnlock'
import { isAdmin as checkIsAdmin } from '@/lib/admin-config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = checkIsAdmin(user.email)
  const admin = createAdminClient()

  const [profileRes, unlocksRes] = await Promise.all([
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    admin
      .from('user_daily_unlocks')
      .select('levels_unlocked_today')
      .eq('user_id', user.id)
      .eq('unlock_date', getTashkentDate())
      .maybeSingle(),
  ])

  const isPremium = isActivePremium(profileRes.data)
  const dailyLimit = isAdmin ? 999 : getDailyLimit(isPremium)
  const unlockedToday = isAdmin ? 0 : (unlocksRes.data?.levels_unlocked_today ?? 0)

  return Response.json({
    unlockedToday,
    dailyLimit,
    isPremium,
    isAdmin,
    nextResetAt: getNextTashkentMidnightISO(),
  })
}

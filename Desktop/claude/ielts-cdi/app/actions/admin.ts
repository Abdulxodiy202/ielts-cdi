'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function toggleUserPremium(
  userId: string,
  isPremium: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient()

    const now = new Date()
    const oneMonthLater = new Date(now)
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

    const updates = isPremium
      ? {
          is_premium: true,
          premium_until: oneMonthLater.toISOString(),
        }
      : {
          is_premium: false,
          premium_until: null,
        }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

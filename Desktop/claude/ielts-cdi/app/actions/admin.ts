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

    // First attempt: with premium_since (requires the column to exist)
    const updatesWithSince: Record<string, unknown> = isPremium
      ? {
          is_premium: true,
          premium_since: now.toISOString(),
          premium_until: oneMonthLater.toISOString(),
        }
      : {
          is_premium: false,
          premium_since: null,
          premium_until: null,
        }

    const { error: err1 } = await supabase
      .from('profiles')
      .update(updatesWithSince)
      .eq('id', userId)

    // If premium_since column doesn't exist yet (pg error 42703), retry without it
    if (err1?.code === '42703') {
      const updatesWithout: Record<string, unknown> = isPremium
        ? {
            is_premium: true,
            premium_until: oneMonthLater.toISOString(),
          }
        : {
            is_premium: false,
            premium_until: null,
          }

      const { error: err2 } = await supabase
        .from('profiles')
        .update(updatesWithout)
        .eq('id', userId)

      if (err2) return { ok: false, error: err2.message }
      return { ok: true }
    }

    if (err1) return { ok: false, error: err1.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

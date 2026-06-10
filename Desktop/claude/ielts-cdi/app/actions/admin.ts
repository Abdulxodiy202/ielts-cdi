'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function toggleUserPremium(userId: string, isPremium: boolean) {
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = isPremium
    ? {
        is_premium: true,
        premium_since: new Date().toISOString(),
        premium_until: (() => {
          const d = new Date()
          d.setMonth(d.getMonth() + 1)
          return d.toISOString()
        })(),
      }
    : {
        is_premium: false,
        premium_since: null,
        premium_until: null,
      }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) throw new Error(error.message)
  return { ok: true }
}

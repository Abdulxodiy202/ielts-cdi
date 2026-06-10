'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function toggleUserPremium(userId: string, isPremium: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: isPremium })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  return { ok: true }
}

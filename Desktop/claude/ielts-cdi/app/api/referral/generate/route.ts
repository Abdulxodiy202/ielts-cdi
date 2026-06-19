export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'CDI-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check if user already has a code
  const { data: profile } = await admin
    .from('profiles')
    .select('referral_code')
    .eq('id', user.id)
    .single()

  if (profile?.referral_code) {
    return Response.json({ referral_code: profile.referral_code })
  }

  // Generate unique code
  let code = ''
  let attempts = 0
  while (attempts < 10) {
    code = genCode()
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (!existing) break
    attempts++
  }

  if (!code) return Response.json({ error: 'Could not generate unique code' }, { status: 500 })

  const { error } = await admin
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ referral_code: code })
}

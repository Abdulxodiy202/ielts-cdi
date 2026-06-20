export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode(): string {
  let code = 'CDI-'
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
  return code
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Get all profiles without a referral code
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')
    .is('referral_code', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!profiles || profiles.length === 0) return Response.json({ updated: 0 })

  // Get all existing codes to check uniqueness in-memory
  const { data: existing } = await admin.from('profiles').select('referral_code').not('referral_code', 'is', null)
  const usedCodes = new Set((existing ?? []).map(p => p.referral_code))

  let updated = 0
  let failed = 0

  for (const profile of profiles) {
    // Generate unique code
    let code = ''
    for (let i = 0; i < 20; i++) {
      const candidate = genCode()
      if (!usedCodes.has(candidate)) { code = candidate; break }
    }
    if (!code) { failed++; continue }

    const { error: updateErr } = await admin
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', profile.id)

    if (updateErr) { failed++; continue }

    usedCodes.add(code)
    updated++
  }

  return Response.json({ updated, failed, total: profiles.length })
}

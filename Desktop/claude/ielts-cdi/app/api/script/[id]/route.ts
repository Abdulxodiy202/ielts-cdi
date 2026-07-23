export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isActivePremium } from '@/lib/utils/premium'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [scriptRes, profileRes] = await Promise.all([
    supabase.from('scripts').select('*').eq('id', id).eq('is_active', true).single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  const script = scriptRes.data
  if (scriptRes.error || !script) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Server-side premium gate: premium script + non-premium user
  // -> forbid. Client uses `code: 'PREMIUM_REQUIRED'` to route the
  // user to the upgrade page instead of showing a generic error.
  if (script.is_premium && !isActivePremium(profileRes.data)) {
    return Response.json(
      { error: 'Premium required', code: 'PREMIUM_REQUIRED' },
      { status: 403 },
    )
  }

  return Response.json(script)
}

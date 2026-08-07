export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'
import { isActivePremium } from '@/lib/utils/premium'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { message, target = 'all' } = await req.json()
  if (!message?.trim()) {
    return Response.json({ error: 'message kerak' }, { status: 400 })
  }
  if (!['all', 'premium', 'free'].includes(target)) {
    return Response.json({ error: 'target noto\'g\'ri' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Pull is_premium + premium_until so premium/free segmentation uses
  // the same rule the user's dashboard uses (isActivePremium). Filtering
  // by .eq('is_premium', true) alone would include legacy rows whose
  // premium has already expired -- the user sees themselves as Free but
  // would still get a "Premium subscriber" broadcast. Not great.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, is_premium, premium_until')

  if (profErr) return Response.json({ error: profErr.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return Response.json({ sent: 0 })
  }

  const segmented = target === 'all'
    ? profiles
    : profiles.filter(p => {
        const active = isActivePremium({
          is_premium: p.is_premium ?? false,
          premium_until: p.premium_until ?? null,
        })
        return target === 'premium' ? active : !active
      })

  if (segmented.length === 0) return Response.json({ sent: 0 })

  // Batch insert one message per user
  const rows = segmented.map(p => ({
    user_id: p.id,
    message: message.trim(),
  }))

  const { error: insertErr } = await admin.from('admin_messages').insert(rows)
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  return Response.json({ sent: rows.length })
}

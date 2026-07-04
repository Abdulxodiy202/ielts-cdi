export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

const TEST_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dictationId = parseInt(id, 10)
  if (isNaN(dictationId)) return Response.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [dictationRes, progressRes, profileRes] = await Promise.all([
    admin.from('dictations').select('*').eq('id', dictationId).single(),
    admin
      .from('dictation_progress')
      .select('best_accuracy, attempts, is_completed, stars')
      .eq('user_id', user.id)
      .eq('dictation_id', dictationId)
      .maybeSingle(),
    admin.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (dictationRes.error || !dictationRes.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const dictation = dictationRes.data
  const isPremium = isActivePremium(profileRes.data)
  const isTestUser = user.email === TEST_EMAIL

  if (dictation.is_premium && !isPremium && !isTestUser) {
    return Response.json({ error: 'Premium required' }, { status: 403 })
  }

  return Response.json({
    dictation,
    progress: progressRes.data ?? null,
    isPremium,
    isTestUser,
  })
}

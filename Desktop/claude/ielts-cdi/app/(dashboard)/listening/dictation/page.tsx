export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'
import { DictationListClient } from './DictationListClient'
import { redirect } from 'next/navigation'

const TEST_EMAIL = 'abdulxdiymamajonov@gmail.com'

export default async function DictationListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [dictationsRes, progressRes, profileRes] = await Promise.all([
    admin.from('dictations').select('*').order('order_index'),
    admin.from('dictation_progress')
      .select('dictation_id, best_accuracy, attempts, is_completed, stars')
      .eq('user_id', user.id),
    admin.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  const dictations = dictationsRes.data ?? []
  const progress   = progressRes.data ?? []
  const profile    = profileRes.data
  const isPremium  = isActivePremium(profile)
  const isTestUser = user.email === TEST_EMAIL

  const progressMap: Record<number, typeof progress[0]> = {}
  for (const p of progress) {
    progressMap[p.dictation_id] = p
  }

  const totalStars = progress.reduce((sum, p) => sum + (p.stars ?? 0), 0)

  return (
    <DictationListClient
      dictations={dictations}
      progressMap={progressMap}
      isPremium={isPremium}
      isTestUser={isTestUser}
      totalStars={totalStars}
    />
  )
}

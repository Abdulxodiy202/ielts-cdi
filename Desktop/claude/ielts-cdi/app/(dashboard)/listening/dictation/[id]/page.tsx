export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'
import { DictationClient } from './DictationClient'
import { notFound, redirect } from 'next/navigation'

const TEST_EMAIL = 'abdulxdiymamajonov@gmail.com'

export default async function DictationExercisePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const dictationId = parseInt(id, 10)
  if (isNaN(dictationId)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  if (dictationRes.error || !dictationRes.data) notFound()

  const dictation  = dictationRes.data
  const progress   = progressRes.data ?? null
  const profile    = profileRes.data
  const isPremium  = isActivePremium(profile)
  const isTestUser = user.email === TEST_EMAIL

  return (
    <DictationClient
      dictation={dictation}
      progress={progress}
      isPremium={isPremium}
      isTestUser={isTestUser}
    />
  )
}

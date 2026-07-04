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
  const profileRes = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .single()

  const isPremium  = isActivePremium(profileRes.data)
  const isTestUser = user.email === TEST_EMAIL

  return <DictationListClient isPremium={isPremium} isTestUser={isTestUser} />
}

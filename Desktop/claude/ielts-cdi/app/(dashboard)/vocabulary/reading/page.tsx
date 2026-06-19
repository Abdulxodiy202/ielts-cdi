import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isActivePremium } from '@/lib/utils/premium'
import ReadingVocabClient from './ReadingVocabClient'

export const revalidate = 300

export default async function ReadingVocabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: tests, error } = await admin
    .from('tests')
    .select('id, title, test_number, order_number, is_premium')
    .eq('type', 'reading')
    .eq('is_published', true)
    .order('order_number')

  if (error) console.error('[vocab/reading] tests query error:', error)

  const profileRes = await supabase
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .single()

  const isPremium = isActivePremium(profileRes.data)

  return <ReadingVocabClient tests={tests ?? []} isPremium={isPremium} />
}

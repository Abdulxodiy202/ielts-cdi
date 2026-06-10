export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TestListClient } from '@/components/test/TestListClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { isActivePremium } from '@/lib/utils/premium'

export default async function ReadingListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [testsRes, profileRes, sessionsRes] = await Promise.all([
    supabase.from('tests').select('*').eq('type', 'reading').eq('is_published', true).order('order_number'),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
  ])

  const tests = testsRes.data ?? []
  const isPremium = isActivePremium(profileRes.data)
  const sessions = sessionsRes.data ?? []

  const sessionMap = Object.fromEntries(sessions.map(s => [s.test_id, s.status]))

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader titleKey="reading.title" subtitleKey="reading.subtitle" />

      <TestListClient tests={tests} isPremium={isPremium} sessionMap={sessionMap} type="reading" />
    </div>
  )
}

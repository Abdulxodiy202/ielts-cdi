export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TestListClient } from '@/components/test/TestListClient'
import { isActivePremium } from '@/lib/utils/premium'

export default async function ListeningListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [testsRes, profileRes, sessionsRes] = await Promise.all([
    supabase.from('tests').select('*').eq('type', 'listening').eq('is_published', true).order('order_number'),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
  ])

  const tests = testsRes.data ?? []
  const isPremium = isActivePremium(profileRes.data)
  const sessions = sessionsRes.data ?? []
  const sessionMap = Object.fromEntries(sessions.map(s => [s.test_id, s.status]))

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Listening Tests
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Academic listening practice · 4 sections · 40 questions · 40 minutes
        </p>
      </div>
      <TestListClient tests={tests} isPremium={isPremium} sessionMap={sessionMap} type="listening" />
    </div>
  )
}

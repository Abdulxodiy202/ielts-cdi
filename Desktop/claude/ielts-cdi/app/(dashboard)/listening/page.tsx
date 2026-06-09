export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListeningPageClient } from '@/components/test/ListeningPageClient'
import { isActivePremium } from '@/lib/utils/premium'

export default async function ListeningListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [fullTestsRes, sectionTestsRes, profileRes, sessionsRes] = await Promise.all([
    // Full IELTS tests (order_number 1–999)
    supabase
      .from('tests')
      .select('*')
      .eq('type', 'listening')
      .eq('is_published', true)
      .lt('order_number', 1000)
      .order('order_number'),
    // Section training tests (order_number 1001+)
    supabase
      .from('tests')
      .select('*')
      .eq('type', 'listening')
      .eq('is_published', true)
      .gte('order_number', 1001)
      .order('order_number'),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
    supabase
      .from('test_sessions')
      .select('test_id, status')
      .eq('user_id', user.id),
  ])

  const fullTests = fullTestsRes.data ?? []
  const sectionTests = sectionTestsRes.data ?? []
  const isPremium = isActivePremium(profileRes.data)
  const sessions = sessionsRes.data ?? []
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.test_id, s.status]))

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Listening Tests
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Academic listening practice · Choose your mode below
        </p>
      </div>
      <ListeningPageClient
        fullTests={fullTests}
        sectionTests={sectionTests}
        isPremium={isPremium}
        sessionMap={sessionMap}
      />
    </div>
  )
}

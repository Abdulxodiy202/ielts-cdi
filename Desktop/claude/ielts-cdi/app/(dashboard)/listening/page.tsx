export const revalidate = 300

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ListeningPageClient } from '@/components/test/ListeningPageClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { isActivePremium } from '@/lib/utils/premium'

/* ── Cached: full listening tests (order < 1000), revalidate 5 min ── */
const getCachedFullListeningTests = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('type', 'listening')
      .eq('is_published', true)
      .lt('order_number', 1000)
      .order('order_number')
    return data ?? []
  },
  ['listening-tests-full'],
  { revalidate: 300 },
)

/* ── Cached: section training tests (order >= 1001), revalidate 5 min ── */
const getCachedSectionTests = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('type', 'listening')
      .eq('is_published', true)
      .gte('order_number', 1001)
      .order('order_number')
    return data ?? []
  },
  ['listening-tests-sections'],
  { revalidate: 300 },
)

export default async function ListeningListPage() {
  // Auth + user-specific data always run fresh (cookies-based)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [fullTests, sectionTests, profileRes, sessionsRes] = await Promise.all([
    getCachedFullListeningTests(),
    getCachedSectionTests(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
  ])

  const isPremium = isActivePremium(profileRes.data)
  const sessions = sessionsRes.data ?? []
  const sessionMap = Object.fromEntries(sessions.map(s => [s.test_id, s.status]))

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader titleKey="listening.title" subtitleKey="listening.subtitle" />
      <ListeningPageClient
        fullTests={fullTests}
        sectionTests={sectionTests}
        isPremium={isPremium}
        sessionMap={sessionMap}
      />
    </div>
  )
}

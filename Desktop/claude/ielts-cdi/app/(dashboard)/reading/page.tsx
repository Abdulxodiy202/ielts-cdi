export const revalidate = 300

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TestListClient } from '@/components/test/TestListClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { isActivePremium } from '@/lib/utils/premium'

/* ── Cached: reading test list (same for all users, revalidate every 5 min) ── */
const getCachedReadingTests = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('type', 'reading')
      .eq('is_published', true)
      .order('order_number')
    return data ?? []
  },
  ['reading-tests'],
  { revalidate: 300 },
)

export default async function ReadingListPage() {
  // Auth + user-specific data always run fresh (cookies-based)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [tests, profileRes, sessionsRes] = await Promise.all([
    getCachedReadingTests(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
  ])

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

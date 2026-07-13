export const revalidate = 300

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TestListClient } from '@/components/test/TestListClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionStarsChip } from '@/components/ui/SectionStarsChip'
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

  const [tests, profileRes, sessionsRes, resultsRes] = await Promise.all([
    getCachedReadingTests(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
    // Pull all completed attempts so we can tally best_stars + attempts
    // per test client-side. Rolls up in JS instead of via SQL view so we
    // don't depend on `user_test_summary` (schema-optional).
    supabase.from('test_results').select('test_id, stars, band_score').eq('user_id', user.id),
  ])

  const isPremium = isActivePremium(profileRes.data)
  const sessions = sessionsRes.data ?? []
  const sessionMap = Object.fromEntries(sessions.map(s => [s.test_id, s.status]))

  const summaryMap: Record<string, { best_stars: number; best_band: number; attempts: number }> = {}
  for (const r of resultsRes.data ?? []) {
    const testId = r.test_id as string
    const stars = (r.stars as number | null) ?? 0
    const band = (r.band_score as number | null) ?? 0
    const cur = summaryMap[testId] ?? { best_stars: 0, best_band: 0, attempts: 0 }
    summaryMap[testId] = {
      best_stars: Math.max(cur.best_stars, stars),
      best_band: Math.max(cur.best_band, band),
      attempts: cur.attempts + 1,
    }
  }
  // Sum best-stars across THIS section's tests only. Per spec: never
  // combine star totals across sections.
  const sectionTotal = Object.values(summaryMap).reduce((s, x) => s + x.best_stars, 0)

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        titleKey="reading.title"
        subtitleKey="reading.subtitle"
        endSlot={<SectionStarsChip total={sectionTotal} />}
      />
      <TestListClient
        tests={tests}
        isPremium={isPremium}
        sessionMap={sessionMap}
        summaryMap={summaryMap}
        type="reading"
      />
    </div>
  )
}

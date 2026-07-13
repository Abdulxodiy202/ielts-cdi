export const revalidate = 300

import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TestListClient } from '@/components/test/TestListClient'
import { CelebrationToast } from '@/components/test/CelebrationToast'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionStarsChip } from '@/components/ui/SectionStarsChip'
import { isActivePremium } from '@/lib/utils/premium'

// Full-Listening test list at its own URL. Split off from /listening
// (mode selector) so post-submit exits + celebration toast land here,
// showing the numbered tests plus this section's ⭐ earned / max chip.

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

export default async function ListeningFullListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [fullTests, profileRes, sessionsRes, resultsRes] = await Promise.all([
    getCachedFullListeningTests(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
    supabase.from('test_sessions').select('test_id, status').eq('user_id', user.id),
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
  // Sum over fullTests only -- guarantees no cross-skill or training
  // leakage even if test_results has extra rows.
  const sectionTotal = fullTests.reduce(
    (s, t) => s + (summaryMap[t.id]?.best_stars ?? 0),
    0,
  )
  const maxStars = fullTests.length * 5

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Suspense fallback={null}>
        <CelebrationToast />
      </Suspense>

      <PageHeader
        titleKey="listening.fullListTitle"
        subtitleKey="listening.fullListSubtitle"
        endSlot={<SectionStarsChip total={sectionTotal} max={maxStars} />}
      />

      <TestListClient
        tests={fullTests}
        isPremium={isPremium}
        sessionMap={sessionMap}
        summaryMap={summaryMap}
        type="listening"
      />
    </div>
  )
}

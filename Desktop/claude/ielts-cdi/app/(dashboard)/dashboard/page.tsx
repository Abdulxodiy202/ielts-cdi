export const revalidate = 60

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TestHistory } from '@/components/dashboard/TestHistory'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ReferralCard } from '@/components/dashboard/ReferralCard'
import { isActivePremium } from '@/lib/utils/premium'

/* ── Cached: global test counts (same for all users, revalidate every 5 min) ── */
const getCachedTestCounts = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const [readingAllRes, readingFreeRes, listeningAllRes, listeningFreeRes] = await Promise.all([
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading'),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading').eq('is_premium', false),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000).eq('is_premium', false),
    ])
    return {
      readingTotal:   readingAllRes.count   ?? 0,
      readingFree:    readingFreeRes.count  ?? 0,
      listeningTotal: listeningAllRes.count ?? 0,
      listeningFree:  listeningFreeRes.count ?? 0,
    }
  },
  ['test-counts'],
  { revalidate: 300 },
)

/* ── Cached: per-user test results + stats only (no profile — that's fetched fresh) ── */
const getCachedUserStats = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient()
    const { data: resultsData } = await supabase
      .from('test_results')
      .select('*, tests(type, title)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50)

    const results = resultsData ?? []
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisWeek = results.filter(r => new Date(r.completed_at) > weekAgo).length
    const bands = results.map(r => r.band_score)
    const avgBand = bands.length ? bands.reduce((a, b) => a + b, 0) / bands.length : 0
    const highestBand = bands.length ? Math.max(...bands) : 0

    return {
      results,
      stats: {
        totalTests:    results.length,
        averageBand:   avgBand,
        highestBand,
        testsThisWeek: thisWeek,
      },
    }
  },
  ['dashboard-stats'],
  { revalidate: 60 },
)

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile fetched FRESH every request so premium status is never stale
  const admin = createAdminClient()
  const [{ results, stats }, counts, profileRes] = await Promise.all([
    getCachedUserStats(user.id),
    getCachedTestCounts(),
    admin.from('profiles').select('full_name, is_premium, premium_until').eq('id', user.id).single(),
  ])

  const profile = profileRes.data
  const firstName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
  const isPremium = isActivePremium(profile)

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <DashboardGreeting
        firstName={firstName}
        totalTests={stats.totalTests}
        isPremium={isPremium}
      />

      <div className="mb-8">
        <StatsCards stats={stats} />
      </div>

      <QuickActions
        readingTotal={counts.readingTotal}
        readingFree={counts.readingFree}
        listeningTotal={counts.listeningTotal}
        listeningFree={counts.listeningFree}
      />

      <ReferralCard />

      <TestHistory results={results.slice(0, 10) as any} showTitle />
    </div>
  )
}

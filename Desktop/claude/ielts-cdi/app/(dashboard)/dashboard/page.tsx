export const revalidate = 60

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BentoDashboard, type RankInfo } from '@/components/dashboard/BentoDashboard'
import { DisplayNameModal } from '@/components/DisplayNameModal'
import { DashboardPaymentOpener } from '@/components/dashboard/DashboardPaymentOpener'
import { isActivePremium } from '@/lib/utils/premium'
import { isFullTest } from '@/lib/utils/testCategory'

/* ── Cached: global test counts (same for all users, revalidate every 5 min) ── */
const getCachedTestCounts = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const [readingAllRes, readingFreeRes, listeningAllRes, listeningFreeRes, videoRes] = await Promise.all([
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading'),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading').eq('is_premium', false),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000),
      supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000).eq('is_premium', false),
      supabase.from('video_lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    ])
    return {
      readingTotal:   readingAllRes.count   ?? 0,
      readingFree:    readingFreeRes.count  ?? 0,
      listeningTotal: listeningAllRes.count ?? 0,
      listeningFree:  listeningFreeRes.count ?? 0,
      videoCount:     videoRes.count ?? 0,
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
      .select('*, tests(type, title, order_number)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(200)

    const results = resultsData ?? []
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisWeek = results.filter(r => new Date(r.completed_at) > weekAgo).length
    const bands = results.map(r => r.band_score)
    const avgBand = bands.length ? bands.reduce((a, b) => a + b, 0) / bands.length : 0
    const highestBand = bands.length ? Math.max(...bands) : 0

    // Distinct full tests completed per skill, for the progress bars.
    const readingDoneIds = new Set<string>()
    const listeningDoneIds = new Set<string>()
    for (const r of results) {
      const test = r.tests as { type?: string; order_number?: number } | null
      if (!test || !isFullTest(test.type, test.order_number)) continue
      if (test.type === 'reading') readingDoneIds.add(r.test_id)
      if (test.type === 'listening') listeningDoneIds.add(r.test_id)
    }

    return {
      results,
      readingDone: readingDoneIds.size,
      listeningDone: listeningDoneIds.size,
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

interface PageProps {
  searchParams: Promise<{ showPayment?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const showPayment = sp.showPayment === 'true'

  // Profile + rank + resume fetched FRESH every request (rank changes
  // with every award; premium status must never be stale).
  const admin = createAdminClient()
  const [
    { results, stats, readingDone, listeningDone },
    counts,
    profileRes,
    rankRes,
    gameRes,
    resumeRes,
  ] = await Promise.all([
    getCachedUserStats(user.id),
    getCachedTestCounts(),
    admin.from('profiles').select('full_name, display_name, phone, is_premium, premium_until').eq('id', user.id).single(),
    admin.rpc('get_user_rank', { p_user_id: user.id }),
    admin.from('game_progress').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_completed', true),
    admin
      .from('test_sessions')
      .select('test_id, tests(type, title)')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const profile = profileRes.data
  const firstName =
    (profile as { display_name?: string | null } | null)?.display_name ||
    profile?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'there'
  const isPremium = isActivePremium(profile)

  const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data
  const rank: RankInfo | null =
    rankRow && typeof rankRow.rank === 'number'
      ? { rank: rankRow.rank, total_points: rankRow.total_points ?? 0, total_users: rankRow.total_users ?? 0 }
      : null

  const resumeRow = resumeRes.data?.[0]
  const resumeTest = resumeRow?.tests as { type?: string; title?: string } | null
  const resume =
    resumeRow && resumeTest?.type
      ? { href: `/${resumeTest.type}/${resumeRow.test_id}`, title: resumeTest.title ?? '' }
      : null

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {showPayment && !isPremium && (
        <DashboardPaymentOpener
          open
          initialName={profile?.full_name ?? ''}
          initialPhone={(profile as { phone?: string } | null)?.phone ?? ''}
        />
      )}
      <DisplayNameModal />
      <BentoDashboard
        firstName={firstName}
        isPremium={isPremium}
        stats={stats}
        counts={counts}
        readingDone={readingDone}
        listeningDone={listeningDone}
        rank={rank}
        gameCompleted={gameRes.count ?? 0}
        videoCount={counts.videoCount}
        resume={resume}
        results={results.slice(0, 10)}
      />
    </div>
  )
}

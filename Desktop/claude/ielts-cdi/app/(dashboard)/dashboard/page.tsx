export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TestHistory } from '@/components/dashboard/TestHistory'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { isActivePremium } from '@/lib/utils/premium'

async function getDashboardData(userId: string) {
  const supabase = await createClient()

  const [resultsRes, profileRes, readingAllRes, readingFreeRes, listeningAllRes, listeningFreeRes] = await Promise.all([
    supabase
      .from('test_results')
      .select('*, tests(type, title)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading'),
    supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'reading').eq('is_premium', false),
    // Only count full listening tests (order_number < 1000), not section-training tests
    supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000),
    supabase.from('tests').select('id', { count: 'exact', head: true }).eq('type', 'listening').lt('order_number', 1000).eq('is_premium', false),
  ])

  const results = resultsRes.data ?? []
  const profile = profileRes.data

  const readingTotal = readingAllRes.count ?? 0
  const readingFree  = readingFreeRes.count ?? 0
  const listeningTotal = listeningAllRes.count ?? 0
  const listeningFree  = listeningFreeRes.count ?? 0

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = results.filter(r => new Date(r.completed_at) > weekAgo).length

  const bands = results.map(r => r.band_score)
  const avgBand = bands.length ? bands.reduce((a, b) => a + b, 0) / bands.length : 0
  const highestBand = bands.length ? Math.max(...bands) : 0

  return {
    results,
    profile,
    stats: {
      totalTests: results.length,
      averageBand: avgBand,
      highestBand,
      testsThisWeek: thisWeek,
    },
    readingTotal,
    readingFree,
    listeningTotal,
    listeningFree,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { results, profile, stats, readingTotal, readingFree, listeningTotal, listeningFree } = await getDashboardData(user.id)
  const firstName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
  const isPremium = isActivePremium(profile)

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header — client component for i18n */}
      <DashboardGreeting
        firstName={firstName}
        totalTests={stats.totalTests}
        isPremium={isPremium}
      />

      {/* Stats */}
      <div className="mb-8">
        <StatsCards stats={stats} />
      </div>

      {/* Quick actions — client component for i18n */}
      <QuickActions
        readingTotal={readingTotal}
        readingFree={readingFree}
        listeningTotal={listeningTotal}
        listeningFree={listeningFree}
      />

      {/* History with translated section title */}
      <TestHistory results={results.slice(0, 10) as any} showTitle />
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TestHistory } from '@/components/dashboard/TestHistory'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { ResultsPageTitle } from '@/components/dashboard/ResultsPageTitle'

export default async function ResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: results } = await supabase
    .from('test_results')
    .select('*, tests(type, title)')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  const data = results ?? []
  const bands = data.map(r => r.band_score)
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const stats = {
    totalTests: data.length,
    averageBand: bands.length ? bands.reduce((a, b) => a + b, 0) / bands.length : 0,
    highestBand: bands.length ? Math.max(...bands) : 0,
    testsThisWeek: data.filter(r => new Date(r.completed_at) > weekAgo).length,
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <ResultsPageTitle />
      <div className="mb-6">
        <StatsCards stats={stats} />
      </div>
      <TestHistory results={data as any} />
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TestHistory } from '@/components/dashboard/TestHistory'
import { BookOpen, Headphones, ArrowRight, Crown } from 'lucide-react'
import Link from 'next/link'
import { calculateBandScore } from '@/lib/utils/bandScore'
import { isActivePremium } from '@/lib/utils/premium'

async function getDashboardData(userId: string) {
  const supabase = await createClient()

  const [resultsRes, profileRes] = await Promise.all([
    supabase
      .from('test_results')
      .select('*, tests(type, title)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('*').eq('id', userId).single(),
  ])

  const results = resultsRes.data ?? []
  const profile = profileRes.data

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
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { results, profile, stats } = await getDashboardData(user.id)
  const firstName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
  const isPremium = isActivePremium(profile)

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Hello, {firstName} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {stats.totalTests === 0
              ? 'Ready to start your IELTS journey?'
              : `You've completed ${stats.totalTests} test${stats.totalTests !== 1 ? 's' : ''} so far.`}
          </p>
        </div>
        {!isPremium && (
          <Link
            href="/premium"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--premium)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <Crown size={16} /> Upgrade to Premium
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8">
        <StatsCards stats={stats} />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/reading"
          className="card p-6 flex items-center justify-between group hover:border-[var(--accent)] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <BookOpen size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>Reading Tests</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>9 tests · 4 free</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/listening"
          className="card p-6 flex items-center justify-between group hover:border-[var(--accent)] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Headphones size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>Listening Tests</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>9 tests · 4 free</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Tests</h2>
        <TestHistory results={results.slice(0, 10) as any} />
      </div>
    </div>
  )
}

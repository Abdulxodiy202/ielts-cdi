'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface DashboardGreetingProps {
  firstName: string
  totalTests: number
  isPremium: boolean
}

export function DashboardGreeting({ firstName, totalTests, isPremium }: DashboardGreetingProps) {
  const { t } = useLanguage()
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('dashboard.hello')}, {firstName} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {totalTests === 0
            ? t('dashboard.readyToStart')
            : t('dashboard.testsCompleted', { count: totalTests })}
        </p>
      </div>
      {!isPremium && (
        <Link
          href="/premium"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--premium)', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          <Crown size={16} /> {t('dashboard.upgradeToPremium')}
        </Link>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  descKey: 'premium.bookDesc' | 'premium.articleDesc'
}

export function PremiumLockScreen({ descKey }: Props) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        <Lock size={28} style={{ color: '#f59e0b' }} />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('premium.contentTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t(descKey)}
        </p>
      </div>
      <Link href="/dashboard" className="btn-primary px-6 py-2.5 text-sm font-semibold">
        {t('premium.getBtn')}
      </Link>
    </div>
  )
}

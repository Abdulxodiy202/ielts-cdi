'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CommunityPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">👥</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('community.title')}</h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>{t('community.soon')}</p>
      </div>
    </div>
  )
}

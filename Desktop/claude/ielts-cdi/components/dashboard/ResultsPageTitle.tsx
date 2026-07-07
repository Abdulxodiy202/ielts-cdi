'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export function ResultsPageTitle() {
  const { t } = useLanguage()
  return (
    <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
      {t('results.title')}
    </h1>
  )
}

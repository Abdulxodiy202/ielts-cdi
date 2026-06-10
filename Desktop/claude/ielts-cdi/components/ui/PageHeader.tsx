'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PageHeaderProps {
  titleKey: string
  subtitleKey: string
}

export function PageHeader({ titleKey, subtitleKey }: PageHeaderProps) {
  const { t } = useLanguage()
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {t(titleKey)}
      </h1>
      <p style={{ color: 'var(--text-muted)' }}>
        {t(subtitleKey)}
      </p>
    </div>
  )
}

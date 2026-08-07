'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PageHeaderProps {
  titleKey: string
  subtitleKey: string
  /** Right-aligned slot on the same row as the title. Wraps below on
      narrow screens so it doesn't crowd the header text. */
  endSlot?: ReactNode
}

export function PageHeader({ titleKey, subtitleKey, endSlot }: PageHeaderProps) {
  const { t } = useLanguage()
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t(titleKey)}
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {t(subtitleKey)}
        </p>
      </div>
      {endSlot && <div className="shrink-0">{endSlot}</div>}
    </div>
  )
}

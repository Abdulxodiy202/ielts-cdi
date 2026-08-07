'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Client-side display for the per-test reading vocabulary "coming soon"
// placeholder. Server page fetches the test row and passes the shape
// this component needs — keeps auth / DB in a server component while
// letting the visible copy react to useLanguage().

interface Props {
  testNumber: number
  testTitle: string | null
}

export function ReadingVocabTestView({ testNumber, testTitle }: Props) {
  const { t } = useLanguage()
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('readingVocabTest.breadcrumbVocab')}</Link>
          <span>/</span>
          <Link href="/vocabulary/reading" className="hover:underline">{t('readingVocabTest.breadcrumbReadingVocab')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('readingVocabTest.testLabel', { n: testNumber })}</span>
        </div>
        <Link
          href="/vocabulary/reading"
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> {t('readingVocabTest.backToReadingVocab')}
        </Link>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('readingVocabTest.titleFormat', { n: testNumber })}
        </h1>
        {testTitle && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{testTitle}</p>
        )}
      </div>

      <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-5xl mb-4">📑</div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('readingVocabTest.comingSoon')}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('readingVocabTest.comingSoonDesc')}
        </p>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Test { id: string; title: string | null; test_number: number }

export default function ReadingVocabClient({ tests }: { tests: Test[] }) {
  const { t } = useLanguage()

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.readingVocab')}</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          📑 {t('vocabulary.readingVocab')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('vocabulary.readingVocabSubtitle')}
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="py-16 text-center rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p>No reading tests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tests.map(test => (
            <div
              key={test.id}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  Test {test.test_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {t('vocabulary.comingSoon')}
                </span>
              </div>
              <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {test.title || `Reading Test ${test.test_number}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-muted)' }}>
        {t('vocabulary.readingTestsSubtitle')}
      </p>
    </div>
  )
}

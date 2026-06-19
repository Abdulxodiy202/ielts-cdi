'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Test {
  id: string
  title: string | null
  test_number: number
  order_number: number
  is_premium: boolean
}

export default function ReadingVocabClient({ tests, isPremium }: { tests: Test[]; isPremium: boolean }) {
  const { t } = useLanguage()
  const router = useRouter()

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.readingVocab')}</span>
        </div>
        <button
          onClick={() => router.push('/vocabulary')}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> Vocabulary ga qaytish
        </button>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          📑 {t('vocabulary.readingVocab')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('vocabulary.readingVocabSubtitle')}
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="py-16 text-center rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-sm">Hali reading testlar yo&#39;q.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tests.map(test => {
            const locked = test.is_premium && !isPremium
            return (
              <Link
                key={test.id}
                href={locked ? '/premium' : `/reading/${test.id}`}
                className="block rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    Test {test.test_number}
                  </span>
                  {test.is_premium ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={isPremium
                        ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
                        : { background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {isPremium ? '⭐ Premium' : '🔒 Premium'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                      Bepul
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-2" style={{ color: locked ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {test.title || `Reading Test ${test.test_number}`}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                  {locked ? 'Premium kerak →' : "Testga o'tish →"}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

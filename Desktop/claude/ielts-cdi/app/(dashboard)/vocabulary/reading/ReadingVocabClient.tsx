'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Crown, Lock, BookOpen } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PaymentModal } from '@/components/PaymentModal'

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
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
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
        <div className="grid gap-4">
          {tests.map((test) => {
            const locked = test.is_premium && !isPremium
            return (
              <div
                key={test.id}
                className="card p-5 flex items-center justify-between gap-4"
                style={{ opacity: locked ? 0.85 : 1 }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg"
                    style={{
                      background: locked ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)',
                      color: locked ? 'var(--premium)' : 'var(--text-muted)',
                    }}
                  >
                    {locked ? <Lock size={20} /> : test.order_number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Reading Test {test.test_number} — Vocabulary
                      </span>
                      {test.is_premium ? (
                        <span className="badge-premium flex items-center gap-1">
                          <Crown size={10} /> {t('test.premium')}
                        </span>
                      ) : (
                        <span className="badge-free">{t('test.free')}</span>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {test.title || `Reading Test ${test.test_number}`}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {locked ? (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        color: 'var(--premium)',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}
                    >
                      <Lock size={14} /> {t('test.unlock')}
                    </button>
                  ) : (
                    <Link
                      href={`/vocabulary/reading/${test.id}`}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <BookOpen size={14} /> Ko&#39;rish
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => setShowPaymentModal(false)}
        type="premium"
        amount={50000}
      />
    </div>
  )
}

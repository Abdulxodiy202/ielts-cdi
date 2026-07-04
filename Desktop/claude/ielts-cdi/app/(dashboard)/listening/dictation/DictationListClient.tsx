'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, Crown, ChevronLeft } from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useRouter } from 'next/navigation'

interface DictationItem {
  id: number
  title: string
  description: string | null
  order_index: number
  is_premium: boolean
  difficulty: string
  duration_seconds: number | null
  // progress (null if never attempted)
  best_accuracy: number | null
  stars: number | null
  is_completed: boolean
}

interface DictationListClientProps {
  isPremium: boolean
  isTestUser: boolean
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   '#10b981',
  medium: '#f59e0b',
  hard:   '#ef4444',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-secondary)' }} />
        <div className="w-14 h-6 rounded-lg" style={{ background: 'var(--bg-secondary)' }} />
      </div>
      <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--bg-secondary)' }} />
      <div className="h-3 rounded w-1/2 mb-3" style={{ background: 'var(--bg-secondary)' }} />
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="w-4 h-4 rounded-full" style={{ background: 'var(--bg-secondary)' }} />
        ))}
      </div>
    </div>
  )
}

export function DictationListClient({ isPremium, isTestUser }: DictationListClientProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading,           setLoading]           = useState(true)
  const [dictations,        setDictations]        = useState<DictationItem[]>([])
  const [showPaymentModal,  setShowPaymentModal]  = useState(false)

  useEffect(() => {
    fetch('/api/dictation/list')
      .then(r => r.ok ? r.json() : [])
      .then((data: DictationItem[]) => {
        setDictations(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const totalStars = dictations.reduce((sum, d) => sum + (d.stars ?? 0), 0)

  const isUnlocked = (index: number): boolean => {
    if (isTestUser || index === 0) return true
    const prev = dictations[index - 1]
    return (prev?.best_accuracy ?? 0) >= 70
  }

  const handleCardClick = (dictation: DictationItem, index: number) => {
    if (!isUnlocked(index)) return
    if (dictation.is_premium && !isPremium && !isTestUser) {
      setShowPaymentModal(true)
      return
    }
    router.push(`/listening/dictation/${dictation.id}`)
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => router.push('/listening')}
            className="flex items-center gap-1.5 text-sm mb-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> {t('test.backToModes')}
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            ✍️ {t('dictation.listTitle')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('dictation.listSubtitle')}
          </p>
        </div>

        {!loading && dictations.length > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl shrink-0"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <span style={{ fontSize: 18 }}>⭐</span>
            <span className="font-bold" style={{ color: '#f59e0b' }}>
              {totalStars} / {dictations.length * 5}
            </span>
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && dictations.length === 0 && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">✍️</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Hozircha diktantlar yo&apos;q
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Admin panel orqali yangi diktant qo&apos;shing.
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && dictations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dictations.map((dictation, index) => {
            const unlocked     = isUnlocked(index)
            const premiumGated = dictation.is_premium && !isPremium && !isTestUser

            return (
              <motion.div
                key={dictation.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => handleCardClick(dictation, index)}
                className="card p-5 cursor-pointer hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ opacity: !unlocked ? 0.6 : 1 }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{
                      background: dictation.is_completed
                        ? 'rgba(34,197,94,0.15)'
                        : 'var(--bg-secondary)',
                      color: dictation.is_completed ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {dictation.is_completed ? '✓' : dictation.order_index}
                  </div>

                  {!unlocked ? (
                    <div
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                    >
                      <Lock size={11} /> {t('dictation.locked')}
                    </div>
                  ) : premiumGated ? (
                    <div
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--premium)' }}
                    >
                      <Crown size={11} /> Premium
                    </div>
                  ) : !dictation.is_premium ? (
                    <div
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}
                    >
                      {t('dictation.free')}
                    </div>
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="font-semibold text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {dictation.title}
                </h3>

                {/* Difficulty + duration */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      background: `${DIFFICULTY_COLORS[dictation.difficulty] ?? '#888'}20`,
                      color: DIFFICULTY_COLORS[dictation.difficulty] ?? 'var(--text-muted)',
                    }}
                  >
                    {dictation.difficulty}
                  </span>
                  {dictation.duration_seconds && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(dictation.duration_seconds / 60)} min
                    </span>
                  )}
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ fontSize: 13, opacity: (dictation.stars ?? 0) >= i ? 1 : 0.2 }}>
                      ⭐
                    </span>
                  ))}
                </div>

                {/* Best accuracy */}
                {dictation.best_accuracy !== null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('dictation.bestAccuracy')}:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{dictation.best_accuracy}%</strong>
                  </p>
                )}
              </motion.div>
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
    </>
  )
}

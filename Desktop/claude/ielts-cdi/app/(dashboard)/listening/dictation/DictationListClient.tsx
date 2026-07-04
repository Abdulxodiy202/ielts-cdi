'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Crown, ChevronLeft } from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useRouter } from 'next/navigation'

interface Dictation {
  id: number
  title: string
  description: string | null
  audio_url: string
  transcript: string
  order_index: number
  difficulty: 'easy' | 'medium' | 'hard'
  is_premium: boolean
  duration_seconds: number | null
}

interface Progress {
  dictation_id: number
  best_accuracy: number
  attempts: number
  is_completed: boolean
  stars: number
}

interface DictationListClientProps {
  dictations: Dictation[]
  progressMap: Record<number, Progress>
  isPremium: boolean
  isTestUser: boolean
  totalStars: number
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   '#10b981',
  medium: '#f59e0b',
  hard:   '#ef4444',
}

export function DictationListClient({
  dictations,
  progressMap,
  isPremium,
  isTestUser,
  totalStars,
}: DictationListClientProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const isUnlocked = (index: number): boolean => {
    if (isTestUser || index === 0) return true
    const prev = dictations[index - 1]
    return (progressMap[prev.id]?.best_accuracy ?? 0) >= 70
  }

  const canAccess = (dictation: Dictation, index: number): boolean => {
    if (!isUnlocked(index)) return false
    if (dictation.is_premium && !isPremium && !isTestUser) return false
    return true
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
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl shrink-0"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <span style={{ fontSize: 18 }}>⭐</span>
          <span className="font-bold" style={{ color: '#f59e0b' }}>
            {totalStars} / {dictations.length * 5}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dictations.map((dictation, index) => {
          const prog         = progressMap[dictation.id]
          const unlocked     = isUnlocked(index)
          const premiumGated = dictation.is_premium && !isPremium && !isTestUser

          const handleClick = () => {
            if (!unlocked) return
            if (premiumGated) { setShowPaymentModal(true); return }
            router.push(`/listening/dictation/${dictation.id}`)
          }

          return (
            <motion.div
              key={dictation.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={handleClick}
              className="card p-5 cursor-pointer hover:opacity-90 transition-all active:scale-[0.98]"
              style={{ opacity: !unlocked ? 0.6 : 1 }}
            >
              {/* Top row: index badge + lock/premium badge */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                  style={{
                    background: prog?.is_completed
                      ? 'rgba(34,197,94,0.15)'
                      : 'var(--bg-secondary)',
                    color: prog?.is_completed ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {prog?.is_completed ? '✓' : dictation.order_index}
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
                {[1, 2, 3, 4, 5].map(i => (
                  <span
                    key={i}
                    style={{ fontSize: 13, opacity: (prog?.stars ?? 0) >= i ? 1 : 0.2 }}
                  >
                    ⭐
                  </span>
                ))}
              </div>

              {/* Best accuracy */}
              {prog && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('dictation.bestAccuracy')}:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{prog.best_accuracy}%</strong>
                </p>
              )}
            </motion.div>
          )
        })}
      </div>

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

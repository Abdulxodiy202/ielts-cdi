'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Clock, CheckCircle, Lock, Play, RotateCcw, Crown, X, ListChecks,
  FileText, Headphones,
} from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StarsBadge } from '@/components/ui/StarsBadge'
import { TestAttemptsModal } from '@/components/test/TestAttemptsModal'

interface Test {
  id: string
  title: string
  description: string
  is_premium: boolean
  order_number: number
}

interface TestSummary {
  best_stars: number
  best_band: number
  attempts: number
}

interface TestListClientProps {
  tests: Test[]
  isPremium: boolean
  sessionMap: Record<string, string>
  summaryMap?: Record<string, TestSummary>
  type: 'reading' | 'listening'
}

// Card grid: 3 ustun desktop, 2 tablet, 1 mobile. Yuqorida icon +
// status, keyin sarlavha + meta, keyin natija chip'lar, oxirida mos
// tugma(lar). Barcha eski logika (premium lock, in progress, completed,
// attempt modal) o'zgarmadi -- faqat layout yangilangan.
export function TestListClient({ tests, isPremium, sessionMap, summaryMap = {}, type }: TestListClientProps) {
  const { t } = useLanguage()
  const [showLockModal, setShowLockModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [attemptsModal, setAttemptsModal] = useState<{ id: string; title: string } | null>(null)

  const canAccess = (test: Test) => !test.is_premium || isPremium
  const handleLockedClick = () => setShowLockModal(true)
  const handleUpgradeFromLock = () => {
    setShowLockModal(false)
    setShowPaymentModal(true)
  }

  // Kategoriya bo'yicha ikon va aksent rang.
  const Icon = type === 'reading' ? FileText : Headphones
  const accentColor = type === 'reading' ? '#3B82F6' : '#A855F7' // blue vs purple
  const accentBg = type === 'reading' ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)'

  // Primary button (Start/Continue) rangi tipga qarab.
  const primaryBtnStyle: React.CSSProperties = {
    background: accentColor,
    color: '#fff',
  }
  const outlineBtnStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  }
  const unlockBtnStyle: React.CSSProperties = {
    background: 'rgba(245,158,11,0.10)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.30)',
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((test, i) => {
          const accessible = canAccess(test)
          const sessionStatus = sessionMap[test.id]
          const completed = sessionStatus === 'completed'
          const inProgress = sessionStatus === 'in_progress'

          const summary = summaryMap[test.id]
          const hasStars = (summary?.best_stars ?? 0) > 0
          const attemptCount = summary?.attempts ?? 0

          return (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="rounded-2xl p-5 flex flex-col transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                minHeight: 210,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)' }}
            >
              {/* ── Top: icon + status ── */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div
                  className="rounded-lg p-2 flex items-center justify-center"
                  style={{ background: accentBg }}
                >
                  <Icon size={20} style={{ color: accentColor }} />
                </div>
                {!accessible ? (
                  <Lock size={16} style={{ color: 'var(--text-muted)' }} aria-label="Premium" />
                ) : completed ? (
                  <CheckCircle size={18} style={{ color: '#22c55e' }} aria-label={t('test.completed')} />
                ) : inProgress ? (
                  <RotateCcw size={16} style={{ color: '#f59e0b' }} aria-label={t('test.inProgress')} />
                ) : null}
              </div>

              {/* ── Middle: title + meta ── */}
              <div className="flex-1 min-w-0">
                <h3
                  className="font-bold text-base leading-snug mb-1.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {test.title}
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {type === 'reading' ? (
                    <>60 {t('test.minutes')} · 3 {t('test.passages')} · 40 {t('test.questions')}</>
                  ) : (
                    <>30 {t('test.minutes')} · 4 {t('test.sections')} · 40 {t('test.questions')}</>
                  )}
                </p>

                {/* Stars + Band chip -- faqat completed bo'lsa */}
                {(hasStars || (summary && summary.best_band > 0)) && (
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {hasStars && <StarsBadge stars={summary!.best_stars} size={16} variant="chip" />}
                    {summary && summary.best_band > 0 && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {t('test.bandChip', { band: summary.best_band })}
                      </span>
                    )}
                  </div>
                )}

                {/* In progress chip -- band chip'i o'rniga */}
                {inProgress && !hasStars && (
                  <p className="text-xs font-semibold mb-3" style={{ color: '#f59e0b' }}>
                    {t('test.inProgress')}
                  </p>
                )}
              </div>

              {/* ── Bottom: actions ── */}
              <div className="flex gap-2 mt-auto">
                {!accessible ? (
                  <button
                    type="button"
                    onClick={handleLockedClick}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                    style={unlockBtnStyle}
                  >
                    <Lock size={14} /> {t('test.unlock')}
                  </button>
                ) : inProgress ? (
                  <>
                    <Link
                      href={`/${type}/${test.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                      style={primaryBtnStyle}
                    >
                      <RotateCcw size={13} /> {t('test.continue')}
                    </Link>
                    {attemptCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAttemptsModal({ id: test.id, title: test.title })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={outlineBtnStyle}
                      >
                        <ListChecks size={13} /> {t('testAttempts.viewButton')}
                      </button>
                    )}
                  </>
                ) : completed ? (
                  <>
                    <Link
                      href={`/${type}/${test.id}`}
                      className="flex-1 inline-flex items-center justify-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      style={outlineBtnStyle}
                    >
                      {t('test.retake')}
                    </Link>
                    {attemptCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAttemptsModal({ id: test.id, title: test.title })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={outlineBtnStyle}
                      >
                        <ListChecks size={13} /> {t('testAttempts.viewButton')}
                      </button>
                    )}
                  </>
                ) : (
                  <Link
                    href={`/${type}/${test.id}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                    style={primaryBtnStyle}
                  >
                    <Play size={13} /> {t('test.start')}
                  </Link>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Premium lock modal */}
      <AnimatePresence>
        {showLockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowLockModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative card p-8 w-full max-w-sm text-center"
              style={{ zIndex: 51 }}
            >
              <button
                onClick={() => setShowLockModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <Lock size={28} style={{ color: 'var(--premium)' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {t('test.premiumTestTitle')}
              </h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t('test.premiumTestDesc')}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleUpgradeFromLock}
                  className="btn-primary w-full font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 0 16px rgba(245,158,11,0.35)',
                  }}
                >
                  <Crown size={16} /> {t('common.upgradeToPremium')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  className="btn-outline w-full text-sm"
                >
                  {t('test.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => setShowPaymentModal(false)}
        type="premium"
        amount={50000}
      />

      {attemptsModal && (
        <TestAttemptsModal
          open={!!attemptsModal}
          onClose={() => setAttemptsModal(null)}
          testId={attemptsModal.id}
          testTitle={attemptsModal.title}
          totalQuestions={40}
        />
      )}
    </>
  )
}

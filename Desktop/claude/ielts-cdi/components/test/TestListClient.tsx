'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Clock, CheckCircle, Lock, Play, RotateCcw, Crown, X } from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'

interface Test {
  id: string
  title: string
  description: string
  is_premium: boolean
  order_number: number
}

interface TestListClientProps {
  tests: Test[]
  isPremium: boolean
  sessionMap: Record<string, string>
  type: 'reading' | 'listening'
}

export function TestListClient({ tests, isPremium, sessionMap, type }: TestListClientProps) {
  const [showLockModal, setShowLockModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const canAccess = (t: Test) => !t.is_premium || isPremium

  const handleLockedClick = () => {
    setShowLockModal(true)
  }

  const handleUpgradeFromLock = () => {
    setShowLockModal(false)
    setShowPaymentModal(true)
  }

  return (
    <>
      <div className="grid gap-4">
        {tests.map((test, i) => {
          const accessible = canAccess(test)
          const sessionStatus = sessionMap[test.id]
          const completed = sessionStatus === 'completed'
          const inProgress = sessionStatus === 'in_progress'

          return (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-5 flex items-center justify-between gap-4"
              style={{ opacity: accessible ? 1 : 0.75 }}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg"
                  style={{
                    background: completed
                      ? 'rgba(34,197,94,0.15)'
                      : inProgress
                        ? 'rgba(245,158,11,0.15)'
                        : accessible
                          ? 'var(--bg-secondary)'
                          : 'rgba(245,158,11,0.1)',
                    color: completed
                      ? 'var(--success)'
                      : inProgress
                        ? 'var(--warning)'
                        : accessible
                          ? 'var(--text-muted)'
                          : 'var(--premium)',
                  }}
                >
                  {completed
                    ? <CheckCircle size={22} />
                    : inProgress
                      ? <RotateCcw size={22} />
                      : !accessible
                        ? <Lock size={20} />
                        : test.order_number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {test.title}
                    </span>
                    {test.is_premium ? (
                      <span className="badge-premium flex items-center gap-1">
                        <Crown size={10} /> Premium
                      </span>
                    ) : (
                      <span className="badge-free">Free</span>
                    )}
                    {completed && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}
                      >
                        Completed
                      </span>
                    )}
                    {inProgress && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}
                      >
                        In Progress
                      </span>
                    )}
                  </div>
                  <div className="text-sm flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    {type === 'reading' ? (
                      <>
                        <span className="flex items-center gap-1"><Clock size={12} /> 60 min</span>
                        <span>·</span><span>3 passages</span>
                        <span>·</span><span>40 questions</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><Clock size={12} /> 40 min</span>
                        <span>·</span><span>4 sections</span>
                        <span>·</span><span>40 questions</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {!accessible ? (
                  <button
                    type="button"
                    onClick={handleLockedClick}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                    style={{
                      background: 'rgba(245,158,11,0.15)',
                      color: 'var(--premium)',
                      border: '1px solid rgba(245,158,11,0.3)',
                    }}
                  >
                    <Lock size={14} /> Unlock
                  </button>
                ) : inProgress ? (
                  <Link href={`/${type}/${test.id}`} className="btn-primary text-sm">
                    <RotateCcw size={14} /> Continue
                  </Link>
                ) : completed ? (
                  <Link href={`/${type}/${test.id}`} className="btn-outline text-sm">
                    Retake
                  </Link>
                ) : (
                  <Link href={`/${type}/${test.id}`} className="btn-primary text-sm">
                    <Play size={14} /> Start
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowLockModal(false)}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative card p-8 w-full max-w-sm text-center"
              style={{ zIndex: 51 }}
            >
              {/* Close */}
              <button
                onClick={() => setShowLockModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>

              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <Lock size={28} style={{ color: 'var(--premium)' }} />
              </div>

              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Premium Test
              </h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Bu test premium foydalanuvchilar uchun. Premium oling va barcha testlarga kiring!
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
                  <Crown size={16} /> Upgrade to Premium
                </button>
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  className="btn-outline w-full text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => setShowPaymentModal(false)}
        type="premium"
        amount={119000}
      />
    </>
  )
}

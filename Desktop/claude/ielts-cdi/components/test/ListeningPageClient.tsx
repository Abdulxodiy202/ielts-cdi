'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Clock, CheckCircle, Lock, Play, RotateCcw, Crown, X,
  ChevronLeft, ChevronRight, Headphones, Zap,
  MessageSquare, Mic, GraduationCap, BookOpen,
} from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'

interface Test {
  id: string
  title: string
  description: string
  is_premium: boolean
  order_number: number
}

interface SectionMeta {
  mode: 'section'
  part: number
  section: number
}

interface ListeningPageClientProps {
  fullTests: Test[]
  sectionTests: Test[]
  isPremium: boolean
  sessionMap: Record<string, string>
}

type Mode = 'select' | 'full' | 'sections'

const PART_INFO = [
  {
    part: 1,
    name: 'Everyday Conversations',
    desc: 'Filling forms, appointments, and everyday social interactions',
    Icon: MessageSquare,
    bg: 'rgba(59,130,246,0.15)',
    color: '#3b82f6',
  },
  {
    part: 2,
    name: 'Non-Academic Monologue',
    desc: 'Announcements, directions, and general information talks',
    Icon: Mic,
    bg: 'rgba(16,185,129,0.15)',
    color: '#10b981',
  },
  {
    part: 3,
    name: 'Academic Discussion',
    desc: 'University tutorials, group projects, and academic seminars',
    Icon: GraduationCap,
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
  },
  {
    part: 4,
    name: 'Academic Lecture',
    desc: 'Dense university lectures on complex academic topics',
    Icon: BookOpen,
    bg: 'rgba(168,85,247,0.15)',
    color: '#a855f7',
  },
]

function parseMeta(description: string): SectionMeta | null {
  try {
    const m = JSON.parse(description)
    if (m?.mode === 'section') return m as SectionMeta
  } catch { /* ignore */ }
  return null
}

export function ListeningPageClient({
  fullTests,
  sectionTests,
  isPremium,
  sessionMap,
}: ListeningPageClientProps) {
  const [mode, setMode] = useState<Mode>('select')
  const [activePart, setActivePart] = useState<number | null>(null)
  const [showLockModal, setShowLockModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const canAccess = (t: Test) => !t.is_premium || isPremium

  const handleLockedClick = () => setShowLockModal(true)
  const handleUpgradeFromLock = () => {
    setShowLockModal(false)
    setShowPaymentModal(true)
  }

  const partTests =
    activePart !== null
      ? sectionTests.filter((t) => parseMeta(t.description)?.part === activePart)
      : []

  function renderTestRow(test: Test, index: number, sectionMode = false) {
    const accessible = canAccess(test)
    const status = sessionMap[test.id]
    const completed = status === 'completed'
    const inProgress = status === 'in_progress'

    const meta = sectionMode ? parseMeta(test.description) : null
    const label = meta ? `Test ${meta.section}` : test.title
    const displayNumber: React.ReactNode = completed ? (
      <CheckCircle size={22} />
    ) : inProgress ? (
      <RotateCcw size={22} />
    ) : !accessible ? (
      <Lock size={20} />
    ) : (
      (meta?.section ?? test.order_number)
    )

    return (
      <motion.div
        key={test.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="card p-5 flex items-center justify-between gap-4"
        style={{ opacity: accessible ? 1 : 0.75 }}
      >
        {/* Left */}
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
            {displayNumber}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {label}
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
            <div
              className="text-sm flex items-center gap-3 flex-wrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {sectionMode ? (
                <>
                  <span className="flex items-center gap-1"><Clock size={12} /> 10 min</span>
                  <span>·</span><span>1 section</span>
                  <span>·</span><span>10 questions</span>
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

        {/* Right */}
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
            <Link href={`/listening/${test.id}`} className="btn-primary text-sm flex items-center gap-1.5">
              <RotateCcw size={14} /> Continue
            </Link>
          ) : completed ? (
            <Link href={`/listening/${test.id}`} className="btn-outline text-sm">
              Retake
            </Link>
          ) : (
            <Link href={`/listening/${test.id}`} className="btn-primary text-sm flex items-center gap-1.5">
              <Play size={14} /> Start
            </Link>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <>
      {/* ── Mode selector ─────────────────────────────────────────── */}
      {mode === 'select' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Full Test card */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setMode('full')}
            className="card p-6 text-left transition-all hover:opacity-90 active:scale-[0.99]"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            >
              <Headphones size={28} style={{ color: '#3b82f6' }} />
            </div>
            <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              📋 Full Test
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Complete IELTS Listening test with all 4 sections in one sitting
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[`${fullTests.length} tests`, '40 min', '4 sections', '40 questions'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
            >
              Choose Test <ChevronRight size={15} />
            </div>
          </motion.button>

          {/* Training with Sections card */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            onClick={() => setMode('sections')}
            className="card p-6 text-left transition-all hover:opacity-90 active:scale-[0.99] relative overflow-hidden"
          >
            {!isPremium && (
              <div className="absolute top-3 right-3">
                <span className="badge-premium flex items-center gap-1 text-xs">
                  <Crown size={10} /> Premium
                </span>
              </div>
            )}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(168,85,247,0.15)' }}
            >
              <Zap size={28} style={{ color: '#a855f7' }} />
            </div>
            <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              🎯 Training with Sections
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Practice one section at a time — focus on your weakest parts
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {['4 parts', '10 tests each', '10 min', '10 questions'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
            >
              Choose Part <ChevronRight size={15} />
            </div>
          </motion.button>
        </div>
      )}

      {/* ── Full test list ─────────────────────────────────────────── */}
      {mode === 'full' && (
        <div>
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Back to modes
          </button>
          <div className="grid gap-4">
            {fullTests.map((t, i) => renderTestRow(t, i, false))}
          </div>
        </div>
      )}

      {/* ── Sections: part picker ──────────────────────────────────── */}
      {mode === 'sections' && activePart === null && (
        <div>
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Back to modes
          </button>
          <div className="grid gap-4 sm:grid-cols-2">
            {PART_INFO.map((info, i) => {
              const { Icon } = info
              const pts = sectionTests.filter(
                (t) => parseMeta(t.description)?.part === info.part
              )
              const freeCount = pts.filter((t) => !t.is_premium).length
              const premiumCount = pts.filter((t) => t.is_premium).length

              return (
                <motion.button
                  key={info.part}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => setActivePart(info.part)}
                  className="card p-5 text-left hover:opacity-90 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: info.bg }}
                    >
                      <Icon size={20} style={{ color: info.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                        Part {info.part}
                      </p>
                      <p className="text-sm font-medium mb-1" style={{ color: info.color }}>
                        {info.name}
                      </p>
                      <p
                        className="text-xs leading-relaxed mb-2.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {info.desc}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}
                        >
                          {freeCount} free
                        </span>
                        <span className="badge-premium text-xs flex items-center gap-1">
                          <Crown size={9} /> {premiumCount} premium
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sections: test list for a part ────────────────────────── */}
      {mode === 'sections' && activePart !== null && (
        <div>
          <button
            onClick={() => setActivePart(null)}
            className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Back to parts
          </button>

          {/* Part header banner */}
          {(() => {
            const info = PART_INFO[activePart - 1]
            const { Icon } = info
            return (
              <div className="card p-4 mb-6 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: info.bg }}
                >
                  <Icon size={18} style={{ color: info.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Section Mode
                  </p>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    Part {activePart} — {info.name}
                  </p>
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
                >
                  🎯 Training
                </span>
              </div>
            )
          })()}

          <div className="grid gap-4">
            {partTests.map((t, i) => renderTestRow(t, i, true))}
          </div>
        </div>
      )}

      {/* ── Premium lock modal ─────────────────────────────────────── */}
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
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
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

      {/* ── Payment modal ──────────────────────────────────────────── */}
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

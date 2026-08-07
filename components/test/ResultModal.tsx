'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, RotateCcw, BarChart2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { getBandColor, getBandLabel } from '@/lib/utils/bandScore'
import { formatTime } from '@/lib/utils/formatters'

interface ResultModalProps {
  open: boolean
  rawScore: number
  bandScore: number
  totalQuestions: number
  timeTaken: number
  testType: 'reading' | 'listening'
  testId: string
}

export function ResultModal({ open, rawScore, bandScore, totalQuestions, timeTaken, testType, testId }: ResultModalProps) {
  const color = getBandColor(bandScore)
  const label = getBandLabel(bandScore)
  const percentage = Math.round((rawScore / totalQuestions) * 100)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative card p-8 max-w-md w-full text-center"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-6"
            >
              <Trophy size={48} className="mx-auto mb-4" style={{ color }} />
              <div className="text-6xl font-black mb-1" style={{ color }}>
                {bandScore}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Band Score — {label}
              </div>
            </motion.div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Correct</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>{rawScore}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle size={14} style={{ color: 'var(--error)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Wrong</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--error)' }}>
                  {totalQuestions - rawScore}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Time</div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatTime(timeTaken)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <span>Score: {rawScore}/{totalQuestions}</span>
                <span>{percentage}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/${testType}`} className="btn-outline flex-1 text-sm">
                <RotateCcw size={14} /> All Tests
              </Link>
              <Link href="/results" className="btn-primary flex-1 text-sm">
                <BarChart2 size={14} /> My Results
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

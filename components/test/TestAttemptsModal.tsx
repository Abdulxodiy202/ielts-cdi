'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StarsBadge } from '@/components/ui/StarsBadge'
import { getBandColor } from '@/lib/utils/bandScore'
import { formatDate } from '@/lib/utils/formatters'

// Per-test attempts modal. Lists every completed attempt (newest first)
// with attempt number, raw score, band, and stars. Attempt numbers are
// assigned by chronological order -- oldest = 1, newest = N -- so the
// user can see progression across retakes.

interface Attempt {
  id: string
  raw_score: number
  band_score: number
  stars: number | null
  completed_at: string
}

interface TestAttemptsModalProps {
  open: boolean
  onClose: () => void
  testId: string
  testTitle: string
  /** Question count used for the "X / TOTAL" display in the raw-score
      column. Reading/Listening full = 40; single section = 10. */
  totalQuestions: number
}

export function TestAttemptsModal({
  open,
  onClose,
  testId,
  testTitle,
  totalQuestions,
}: TestAttemptsModalProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<Attempt[]>([])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('test_results')
        .select('id, raw_score, band_score, stars, completed_at')
        .eq('user_id', user.id)
        .eq('test_id', testId)
        .order('completed_at', { ascending: false })
      setAttempts((data ?? []) as Attempt[])
      setLoading(false)
    }
    load()
  }, [open, testId])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative card w-full max-w-2xl"
            style={{ zIndex: 51, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {t('testAttempts.title')}
                </p>
                <h2 className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {testTitle}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                </div>
              ) : attempts.length === 0 ? (
                <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <p>{t('testAttempts.empty')}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {t('testAttempts.attempt')}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {t('testAttempts.correct')}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {t('testAttempts.band')}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {t('testAttempts.stars')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a, i) => {
                      // Reverse-order numbering: newest (index 0) is highest.
                      const attemptNumber = attempts.length - i
                      const stars = a.stars ?? 0
                      const bandColor = getBandColor(a.band_score)
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {t('testAttempts.attemptN', { n: attemptNumber })}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(a.completed_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                            {a.raw_score}/{totalQuestions}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-black text-base" style={{ color: bandColor }}>
                              {a.band_score}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {stars > 0 ? (
                              <StarsBadge stars={stars} size={14} variant="inline" />
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

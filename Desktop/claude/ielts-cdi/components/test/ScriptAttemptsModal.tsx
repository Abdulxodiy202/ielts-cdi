'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StarsBadge } from '@/components/ui/StarsBadge'
import { formatDate } from '@/lib/utils/formatters'

// Per-script attempts modal. Lists every row in script_attempts (newest
// first) for this (user, script), plus a compact "best" summary at the
// top pulled from script_progress. Same visual + interaction pattern as
// TestAttemptsModal -- differences are only in the columns (accuracy%
// instead of raw/band).

interface Attempt {
  id: number | string
  accuracy: number
  stars: number | null
  attempted_at: string
}

interface Best {
  best_accuracy: number
  best_stars: number
  attempts: number
}

interface ScriptAttemptsModalProps {
  open: boolean
  onClose: () => void
  scriptId: number
  scriptTitle: string
}

export function ScriptAttemptsModal({
  open, onClose, scriptId, scriptTitle,
}: ScriptAttemptsModalProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [best, setBest] = useState<Best | null>(null)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [attemptsRes, progressRes] = await Promise.all([
        supabase
          .from('script_attempts')
          .select('id, accuracy, stars, attempted_at')
          .eq('user_id', user.id)
          .eq('script_id', scriptId)
          .order('attempted_at', { ascending: false }),
        supabase
          .from('script_progress')
          .select('best_accuracy, best_stars, attempts')
          .eq('user_id', user.id)
          .eq('script_id', scriptId)
          .maybeSingle(),
      ])

      setAttempts((attemptsRes.data ?? []) as Attempt[])
      setBest((progressRes.data as Best | null) ?? null)
      setLoading(false)
    }
    load()
  }, [open, scriptId])

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
                  {scriptTitle}
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

            {best && (
              <div className="px-5 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('scriptAttempts.bestSummary', { pct: best.best_accuracy })}
                </span>
                {best.best_stars > 0 && (
                  <StarsBadge stars={best.best_stars} size={14} variant="inline" />
                )}
                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('scriptAttempts.totalAttempts', { count: best.attempts })}
                </span>
              </div>
            )}

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
                        {t('scriptAttempts.accuracy')}
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
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {t('testAttempts.attemptN', { n: attemptNumber })}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(a.attempted_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold" style={{ color: a.accuracy >= 70 ? 'var(--success)' : 'var(--text-primary)' }}>
                            {a.accuracy}%
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

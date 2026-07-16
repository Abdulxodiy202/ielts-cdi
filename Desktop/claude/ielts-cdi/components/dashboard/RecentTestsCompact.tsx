'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Headphones, ChevronDown, ChevronRight } from 'lucide-react'
import { getBandColor } from '@/lib/utils/bandScore'
import { formatDate, formatTime } from '@/lib/utils/formatters'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Slim replacement for the 6-column Recent Tests table on the
// dashboard. Collapsed rows show icon + title + band; clicking expands
// (one at a time) to reveal score / time / date -- same data the old
// table showed, nothing dropped. Caps at the 5 newest; full history
// stays on /results.

interface TestResult {
  id: string
  band_score: number
  raw_score: number
  time_taken: number
  completed_at: string
  tests: {
    type: 'reading' | 'listening'
    title: string
  }
}

const MAX_ROWS = 5

export function RecentTestsCompact({ results }: { results: TestResult[] }) {
  const { t } = useLanguage()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = results.slice(0, MAX_ROWS)

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {t('dashboard.recentTests')}
      </h2>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <BookOpen size={36} className="opacity-25 mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('history.empty')}</p>
        </div>
      ) : (
        <div className="flex-1">
          {rows.map((r, i) => {
            const expanded = expandedId === r.id
            const color = getBandColor(r.band_score)
            const Icon = r.tests.type === 'reading' ? BookOpen : Headphones
            const denominator = r.tests.title?.toLowerCase().includes('part') ? 10 : 40
            return (
              <div key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full flex items-center gap-3 py-3 px-2 text-left transition-colors hover:bg-[var(--bg-card-hover)] rounded-lg"
                >
                  <Icon size={16} className="shrink-0" style={{ color: r.tests.type === 'reading' ? 'var(--accent)' : '#ec4899' }} />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.tests.title}
                  </span>
                  <span className="font-black text-base shrink-0" style={{ color }}>
                    {r.band_score}
                  </span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 transition-transform"
                    style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none' }}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="pb-3 px-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2">
                          <span>{t('history.score')}: <strong style={{ color: 'var(--text-secondary)' }}>{r.raw_score}/{denominator}</strong></span>
                          <span>{t('history.time')}: <strong style={{ color: 'var(--text-secondary)' }}>{formatTime(r.time_taken)}</strong></span>
                          <span>{t('history.date')}: <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(r.completed_at)}</strong></span>
                        </div>
                        <Link
                          href="/results"
                          className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80"
                          style={{ color: 'var(--accent)' }}
                        >
                          {t('dashboard.viewResults')} <ChevronRight size={13} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {rows.length > 0 && (
        <Link
          href="/results"
          className="inline-flex items-center gap-1 text-sm font-medium mt-3 hover:opacity-80 self-start"
          style={{ color: 'var(--accent)' }}
        >
          {t('dashboard.viewAll')} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

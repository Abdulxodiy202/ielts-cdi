'use client'

import { motion } from 'framer-motion'
import { BookOpen, Headphones, Clock } from 'lucide-react'
import { getBandColor } from '@/lib/utils/bandScore'
import { formatDate, formatTime } from '@/lib/utils/formatters'
import { useLanguage } from '@/lib/i18n/LanguageContext'

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

interface TestHistoryProps {
  results: TestResult[]
  /** If true, renders a translated "Recent Tests" heading above the table */
  showTitle?: boolean
}

export function TestHistory({ results, showTitle }: TestHistoryProps) {
  const { t } = useLanguage()

  const title = showTitle ? (
    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
      {t('dashboard.recentTests')}
    </h2>
  ) : null

  if (results.length === 0) {
    return (
      <>
        {title}
        <div className="card p-10 text-center">
          <BookOpen size={40} className="mx-auto mb-4 opacity-40" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>{t('history.empty')}</p>
        </div>
      </>
    )
  }

  const headers = [
    t('history.test'),
    t('history.type'),
    t('history.band'),
    t('history.score'),
    t('history.time'),
    t('history.date'),
  ]

  return (
    <>
      {title}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {headers.map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const color = getBandColor(r.band_score)
                const Icon = r.tests.type === 'reading' ? BookOpen : Headphones
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="transition-colors hover:bg-[var(--bg-card-hover)]"
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.tests.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <Icon size={14} /> {r.tests.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-black text-base" style={{ color }}>{r.band_score}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {r.raw_score}/40
                    </td>
                    <td className="px-4 py-3 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Clock size={12} /> {formatTime(r.time_taken)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(r.completed_at)}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

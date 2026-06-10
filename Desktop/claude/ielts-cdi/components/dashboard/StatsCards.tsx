'use client'

import { motion } from 'framer-motion'
import { BookOpen, TrendingUp, Award, Calendar } from 'lucide-react'
import { getBandColor } from '@/lib/utils/bandScore'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Stats {
  totalTests: number
  averageBand: number
  highestBand: number
  testsThisWeek: number
}

interface StatsCardsProps {
  stats: Stats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useLanguage()

  const cards = [
    { label: t('stats.testsTaken'),  value: stats.totalTests,             icon: BookOpen,    color: 'var(--accent)'   },
    { label: t('stats.averageBand'), value: stats.averageBand.toFixed(1), icon: TrendingUp,  color: getBandColor(stats.averageBand) },
    { label: t('stats.highestBand'), value: stats.highestBand.toFixed(1), icon: Award,       color: getBandColor(stats.highestBand) },
    { label: t('stats.thisWeek'),    value: stats.testsThisWeek,          icon: Calendar,    color: 'var(--success)'  },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${card.color}20` }}
            >
              <card.icon size={20} style={{ color: card.color }} />
            </div>
          </div>
          <div className="text-3xl font-black mb-1" style={{ color: card.color }}>
            {card.value}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{card.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

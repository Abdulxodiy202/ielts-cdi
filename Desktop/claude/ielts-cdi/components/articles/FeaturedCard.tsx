'use client'

import Link from 'next/link'
import { Clock, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { CATEGORY_COLOR, CATEGORY_LABEL, deriveCategory, deriveReadingMinutes } from '@/lib/utils/articleCategory'
import { difficultyColor } from '@/lib/utils/articleDifficulty'
import type { CardArticle } from '@/components/articles/ArticleCard'

interface FeaturedCardProps {
  article: CardArticle
  description?: string | null
  locked?: boolean
  delay?: number
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

// Today's Picks'dagi katta karta (col-span-2, row-span-2). Chap
// tarafda kategoriya rangida qalinroq accent chiziq, ichida keng
// description + ajratuvchi + o'qish vaqti.
export function FeaturedCard({ article, description, locked = false, delay = 0 }: FeaturedCardProps) {
  const category = deriveCategory(article.id)
  const catColor = CATEGORY_COLOR[category]
  const diffColor = difficultyColor(article.difficulty)
  const mins = deriveReadingMinutes(article.id)
  const diffKey = article.difficulty ?? 'easy'

  const href = locked ? '/premium' : `/articles/${article.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="lg:col-span-2 lg:row-span-2 h-full"
    >
      <Link
        href={href}
        className="flex flex-col rounded-2xl p-6 md:p-7 h-full transition-all hover:scale-[1.005]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${catColor.accent}`,
          minHeight: 300,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span
            className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: catColor.bg, color: catColor.accent, border: `1px solid ${catColor.border}` }}
          >
            {CATEGORY_LABEL[category]}
          </span>
          <span
            className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: diffColor.accentBg, color: diffColor.accent, border: `1px solid ${diffColor.accentBorder}` }}
          >
            {DIFFICULTY_LABEL[diffKey]}
          </span>
          {locked && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <Lock size={11} /> Premium
            </span>
          )}
        </div>

        <h3
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ color: 'var(--text-primary)', lineHeight: 1.25 }}
        >
          {article.title}
        </h3>

        {description && (
          <p
            className="text-sm md:text-base mb-6"
            style={{
              color: 'var(--text-muted)',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}

        {/* Ajratuvchi + o'qish vaqti pastda joylashadi (mt-auto) */}
        <div className="mt-auto">
          <div className="h-px w-full mb-3" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={13} />
            <span>{mins} min read</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

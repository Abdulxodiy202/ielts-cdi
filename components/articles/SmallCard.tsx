'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Clock, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { CATEGORY_COLOR, CATEGORY_LABEL, articleCategoryFor, articleReadMinutesFor } from '@/lib/utils/articleCategory'
import { difficultyColor } from '@/lib/utils/articleDifficulty'
import type { CardArticle } from '@/components/articles/ArticleCard'

interface SmallCardProps {
  article: CardArticle
  locked?: boolean
  delay?: number
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

// Today's Picks o'ng tarafdagi 2x2 grid'i uchun kompakt kartasi.
// Library ArticleCard'idan kichikroq -- kichik badge'lar, kam
// padding, 140px min balandlik. Chap accent chiziq (kategoriya
// rangida) mavjud.
function SmallCardInner({ article, locked = false, delay = 0 }: SmallCardProps) {
  const category = articleCategoryFor(article)
  const catColor = CATEGORY_COLOR[category]
  const diffColor = difficultyColor(article.difficulty)
  const mins = articleReadMinutesFor(article)
  const diffKey = article.difficulty ?? 'easy'

  const href = locked ? '/premium' : `/articles/${article.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        href={href}
        className="block rounded-xl p-4 h-full transition-all hover:scale-[1.01]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${catColor.accent}`,
          minHeight: 140,
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span
            className="inline-block px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{
              fontSize: 10,
              background: catColor.bg,
              color: catColor.accent,
              border: `1px solid ${catColor.border}`,
            }}
          >
            {CATEGORY_LABEL[category]}
          </span>
          <span
            className="inline-block px-2 py-0.5 rounded font-semibold"
            style={{
              fontSize: 10,
              background: diffColor.accentBg,
              color: diffColor.accent,
              border: `1px solid ${diffColor.accentBorder}`,
            }}
          >
            {DIFFICULTY_LABEL[diffKey]}
          </span>
          {locked && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold"
              style={{
                fontSize: 10,
                background: 'rgba(245,158,11,0.12)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <Lock size={9} />
            </span>
          )}
        </div>

        <h3
          className="font-semibold text-sm mb-2"
          style={{
            color: 'var(--text-primary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {article.title}
        </h3>

        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock size={11} />
          <span>{mins} min</span>
        </div>
      </Link>
    </motion.div>
  )
}

// memo — same rationale as ArticleCard: Today's Picks re-renders when
// unrelated hub state changes, and each card's props are stable arrays.
export const SmallCard = memo(SmallCardInner)

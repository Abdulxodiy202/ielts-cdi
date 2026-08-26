'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Clock, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { CATEGORY_COLOR, CATEGORY_LABEL, articleCategoryFor, articleReadMinutesFor } from '@/lib/utils/articleCategory'
import { difficultyColor } from '@/lib/utils/articleDifficulty'
import { StarsBadge } from '@/components/ui/StarsBadge'

export interface CardArticle {
  id: string
  title: string
  is_premium: boolean
  difficulty: 'easy' | 'medium' | 'hard' | null
  category?: string | null
  read_time?: number | null
}

interface ArticleCardProps {
  article: CardArticle
  locked?: boolean
  delay?: number
  // Shu article uchun eng yaxshi (maksimal) yulduz natijasi -- backend
  // Math.max bilan saqlaydi, keyingi past urinishlar uni bosib
  // yubormaydi; faqat shuni har bir karta ustida ko'rsatish yetmayotgan
  // edi ("qaysi article uchunligi bilinmayabdi"). undefined/0 bo'lsa --
  // hali test ishlanmagan, badge ko'rsatilmaydi.
  bestStars?: number
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

// Library grid'i uchun kichik karta. Chap tarafda kategoriya rangida
// 4px'lik accent chiziq (spec 3-bo'lim). Sarlavha 2 qatorgacha
// clamp qilinadi. memo -- parent (Articles list) has many cards and
// re-renders whenever any card-independent state changes (filter,
// search); article rows themselves don't change between renders, so
// memo skips the whole subtree.
function ArticleCardInner({ article, locked = false, delay = 0, bestStars = 0 }: ArticleCardProps) {
  const category = articleCategoryFor(article)
  const catColor = CATEGORY_COLOR[category]
  const diffColor = difficultyColor(article.difficulty)
  const mins = articleReadMinutesFor(article)
  const diffKey = article.difficulty ?? 'easy'

  const href = locked ? '/premium' : `/articles/${article.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        href={href}
        className="block rounded-2xl p-5 h-full transition-all hover:scale-[1.01]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${catColor.accent}`,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-3">
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
            // Faqat qulf iconi -- "Premium" matni olib tashlangan
            // (ortiqcha edi, qulf o'zi tushunarli).
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: 26,
                height: 26,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b',
              }}
              aria-label="Premium"
            >
              <Lock size={13} />
            </span>
          )}
        </div>

        <h3
          className="text-lg font-semibold mb-3"
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

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={12} />
            <span>{mins} min</span>
          </div>
          {bestStars > 0 && <StarsBadge stars={bestStars} size={13} variant="chip" />}
        </div>
      </Link>
    </motion.div>
  )
}

export const ArticleCard = memo(ArticleCardInner)

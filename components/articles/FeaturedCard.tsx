'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Clock, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { CATEGORY_COLOR, CATEGORY_LABEL, articleCategoryFor, articleReadMinutesFor } from '@/lib/utils/articleCategory'
import { difficultyColor } from '@/lib/utils/articleDifficulty'
import { StarsBadge } from '@/components/ui/StarsBadge'
import type { CardArticle } from '@/components/articles/ArticleCard'

interface FeaturedCardProps {
  article: CardArticle
  description?: string | null
  // Description bo'sh bo'lsa, content'ning boshidan excerpt yasab
  // ko'rsatamiz -- admin har article'ga alohida description
  // yozmasligi mumkin, lekin content doim bor.
  content?: string | null
  locked?: boolean
  delay?: number
  // Shu article uchun eng yaxshi (maksimal) yulduz natijasi -- ArticleCard
  // bilan bir xil rationale.
  bestStars?: number
}

// Markdown belgilarni ozroq tozalab, birinchi 200 belgigacha excerpt
// beradi. Yangi qatorlar bo'shliq bilan almashadi. Ideal solution
// emas (heading/list belgilari ham matn ichida ekan uchraydi), lekin
// katta kartada 3-4 qatorli tanish uchun yetarli.
function excerptFromContent(md: string, max = 200): string {
  const cleaned = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max).trimEnd() + '…'
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

// Today's Picks'dagi katta karta (col-span-2, row-span-2). Chap
// tarafda kategoriya rangida qalinroq accent chiziq, ichida keng
// description + ajratuvchi + o'qish vaqti.
function FeaturedCardInner({ article, description, content, locked = false, delay = 0, bestStars = 0 }: FeaturedCardProps) {
  const category = articleCategoryFor(article)
  const catColor = CATEGORY_COLOR[category]
  const diffColor = difficultyColor(article.difficulty)
  const mins = articleReadMinutesFor(article)
  const diffKey = article.difficulty ?? 'easy'

  const href = locked ? '/premium' : `/articles/${article.id}`

  // Description ustunlik qiladi. Bo'sh bo'lsa content'dan excerpt.
  // Ikkalasi ham yo'q bo'lsa null qaytadi va matn qismi ko'rinmaydi.
  const excerpt =
    description && description.trim()
      ? description.trim()
      : content && content.trim()
        ? excerptFromContent(content)
        : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="h-full"
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
            // Faqat qulf ikoni -- "Premium" matni olib tashlangan.
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b',
              }}
              aria-label="Premium"
            >
              <Lock size={14} />
            </span>
          )}
          {bestStars > 0 && <StarsBadge stars={bestStars} size={14} variant="chip" />}
        </div>

        <h3
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ color: 'var(--text-primary)', lineHeight: 1.25 }}
        >
          {article.title}
        </h3>

        {excerpt && (
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
            {excerpt}
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

export const FeaturedCard = memo(FeaturedCardInner)

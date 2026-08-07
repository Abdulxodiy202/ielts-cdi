'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { BOOK_CATEGORIES, type BookCategory } from '@/lib/utils/bookCategories'

// Category-hub visual config, mirroring /vocabulary's card style so the
// two pages read as members of the same design system. Colors are chosen
// per the task spec; icons are unicode glyphs (same convention as the
// vocabulary hub, so no new lucide imports are needed here).
const CATEGORY_CARDS: {
  slug: BookCategory
  emoji: string
  color: string
  bg: string
  border: string
}[] = [
  {
    slug: 'grammar',
    emoji: '📖',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
  },
  {
    slug: 'ielts',
    emoji: '🎯',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
  },
  {
    slug: 'vocabulary',
    emoji: '📚',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    slug: 'fun_reads',
    emoji: '✨',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
  },
]

interface BookRow {
  id: string
  category: BookCategory | null
}

export default function BooksHubPage() {
  const { t } = useLanguage()
  // null = still loading; Record = fetched counts per category slug.
  const [counts, setCounts] = useState<Record<BookCategory, number> | null>(null)

  useEffect(() => {
    fetch('/api/books')
      .then(r => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        const tally: Record<BookCategory, number> = { grammar: 0, ielts: 0, vocabulary: 0, fun_reads: 0 }
        if (Array.isArray(data)) {
          for (const raw of data as BookRow[]) {
            const cat = raw.category
            if (cat && (BOOK_CATEGORIES as string[]).includes(cat)) {
              tally[cat] += 1
            }
          }
        }
        setCounts(tally)
      })
      .catch(() => {
        // Match /vocabulary's failure mode: show cards without counts.
        setCounts({ grammar: 0, ielts: 0, vocabulary: 0, fun_reads: 0 })
      })
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          📚 {t('books.title')}
        </h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          {t('books.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORY_CARDS.map(cat => {
          const count = counts?.[cat.slug]
          const countLabel = count === undefined ? '...' : t('books.bookCount', { count })
          return (
            <Link
              key={cat.slug}
              href={`/books/${cat.slug}`}
              className="group block rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              style={{ background: cat.bg, border: `1px solid ${cat.border}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{cat.emoji}</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
                >
                  {countLabel}
                </span>
              </div>
              <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                {t(`books.categories.${cat.slug}`)}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t(`books.categoryDescs.${cat.slug}`)}
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: cat.color }}>
                {t('books.open')} <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

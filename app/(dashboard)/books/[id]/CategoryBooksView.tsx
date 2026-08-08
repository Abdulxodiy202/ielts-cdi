'use client'

import { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ArrowRight, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { BOOK_CATEGORY_COLORS, DEFAULT_BOOK_CATEGORY, type BookCategory } from '@/lib/utils/bookCategories'

/** Filtered book grid for a single category, at `/books/[category]`. Kept
    isolated from the reader page (also at `/books/[id]`) via the category-
    slug detection in the parent server component -- category slugs are one
    of four fixed strings, book IDs are UUIDs, so there's no overlap. */
interface Book {
  id: string
  title: string
  author: string | null
  heyzine_url: string
  cover_image_url: string | null
  /** @deprecated Legacy single-language pitch, pre-migration rows only. */
  recommendation: string | null
  recommendation_uz: string | null
  recommendation_en: string | null
  category: BookCategory
  is_premium: boolean
  is_published: boolean
  created_at: string
}

/** Locale-aware pick with UZ fallback. If the site lang is EN but the
    admin hasn't filled recommendation_en yet, fall through to _uz (and
    finally to the legacy `recommendation`) so the tavsiya slot is never
    blank on published books. */
function pickRecommendation(book: Book, lang: 'en' | 'uz'): string {
  if (lang === 'en') {
    return book.recommendation_en?.trim()
      || book.recommendation_uz?.trim()
      || book.recommendation?.trim()
      || ''
  }
  return book.recommendation_uz?.trim()
    || book.recommendation?.trim()
    || book.recommendation_en?.trim()
    || ''
}

const COVER_GRADIENTS = [
  'linear-gradient(160deg, #312e81 0%, #4f46e5 60%, #7c3aed 100%)',
  'linear-gradient(160deg, #134e4a 0%, #0d9488 60%, #06b6d4 100%)',
  'linear-gradient(160deg, #831843 0%, #db2777 60%, #f472b6 100%)',
  'linear-gradient(160deg, #14532d 0%, #16a34a 60%, #4ade80 100%)',
  'linear-gradient(160deg, #78350f 0%, #d97706 60%, #fbbf24 100%)',
]
function bookColor(id: string, arr: string[]) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

/** Recommendation length above which the "Show more/less" toggle appears.
    Below this, the tavsiya fits in two clamp lines comfortably and the
    button is noise. */
const RECOMMENDATION_TRUNCATE_AT = 100

/* ── Single book card (memoized) ────────────────────────────────────────
   Extracted from the grid so the parent's filter/hover state doesn't
   force every card to re-render. React.memo on a shallow-comparable
   props shape keeps a 30-book category page cheap. */
interface BookCardProps {
  book: Book
  locked: boolean
  gradient: string
  recommendation: string
  categoryLabel: string
  premiumLabel: string
  readLabel: string
  showMoreLabel: string
  showLessLabel: string
  onOpen: () => void
  onUpgrade: () => void
}

const BookCard = memo(function BookCard({
  book, locked, gradient, recommendation,
  categoryLabel, premiumLabel, readLabel, showMoreLabel, showLessLabel,
  onOpen, onUpgrade,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = recommendation.length > RECOMMENDATION_TRUNCATE_AT
  const bookCategory = book.category ?? DEFAULT_BOOK_CATEGORY
  const categoryColors = BOOK_CATEGORY_COLORS[bookCategory]

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300
                 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Cover — 3:4, hover zoom via inner img scale */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: '3 / 4',
          background: book.cover_image_url ? 'var(--bg-secondary)' : gradient,
          cursor: locked ? 'default' : 'pointer',
        }}
        onClick={() => !locked && onOpen()}
      >
        {book.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2 p-3"
            style={{ transition: 'transform 0.5s' }}
          >
            <div style={{ fontSize: 32, opacity: 0.4 }}>📖</div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.3 }}>
              {book.title}
            </p>
          </div>
        )}

        {/* Category chip — top-left, sits over the cover art. */}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${categoryColors.bg} ${categoryColors.text} ${categoryColors.border}`}
            style={{ whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Premium chip — top-right, uses amber/black for punch */}
        {book.is_premium && (
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(245, 158, 11, 0.92)', color: '#000' }}
          >
            {premiumLabel}
          </div>
        )}

        {/* Locked overlay — blur + centered lock icon; blocks clicks on
            the cover itself so only the Upgrade button fires. */}
        {locked && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}
            >
              <Lock size={18} color="white" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3
          className="font-semibold text-sm line-clamp-1"
          style={{ color: 'var(--text-primary)' }}
          title={book.title}
        >
          {book.title}
        </h3>
        {book.author && (
          <p
            className="text-xs line-clamp-1"
            style={{ color: 'var(--text-muted)' }}
            title={book.author}
          >
            {book.author}
          </p>
        )}

        {/* Tavsiya — truncated to 2 lines by default with expand toggle
            when it's actually longer than the clamp fits. */}
        {recommendation && (
          <div className="pt-1">
            <p
              className={expanded ? '' : 'line-clamp-2'}
              style={{ fontSize: 11.5, color: '#f59e0b', lineHeight: 1.5 }}
            >
              💡 {recommendation}
            </p>
            {canExpand && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-1 text-xs transition-colors hover:opacity-80"
                style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {expanded ? showLessLabel : showMoreLabel}
              </button>
            )}
          </div>
        )}

        {/* Read / Upgrade CTA */}
        {locked ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full mt-2 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium
                       transition-all duration-300 active:scale-95"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <Lock size={13} /> {premiumLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="group/btn w-full mt-2 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white
                       transition-all duration-300 active:scale-95
                       bg-gradient-to-r from-purple-600 to-purple-500
                       hover:from-purple-500 hover:to-purple-400
                       hover:shadow-lg hover:shadow-purple-500/30"
          >
            <span>{readLabel}</span>
            <ArrowRight size={15} className="transition-transform group-hover/btn:translate-x-1" />
          </button>
        )}
      </div>
    </div>
  )
})

export default function CategoryBooksView({ category }: { category: BookCategory }) {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/books?category=${category}`)
      .then(async r => { const d = await r.json().catch(() => []); if (Array.isArray(d)) setBooks(d) })
      .finally(() => setLoading(false))
  }, [category])

  const categoryLabel = t(`books.categories.${category}`)
  const premiumLabel = t('books.premiumBadge')
  const readLabel = t('books.read')
  const showMoreLabel = t('books.showMore')
  const showLessLabel = t('books.showLess')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb / back */}
        <Link
          href="/books"
          className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={14} /> {t('books.title')}
          <span className="mx-1" style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{categoryLabel}</span>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {categoryLabel}
            <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
              ({books.length} {t('books.countSuffix')})
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t(`books.categoryDescs.${category}`)}
          </p>
        </div>

        {books.length === 0 ? (
          <div className="py-20 text-center rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p className="font-medium">
              {t('books.emptyCategory', { category: categoryLabel })}
            </p>
          </div>
        ) : (
          // Denser grid than before: 2 columns on mobile, 5 on xl. Cards
          // are self-contained so a lone book still looks intentional.
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {books.map(book => {
              const locked = book.is_premium && !isPremium
              const gradient = bookColor(book.id, COVER_GRADIENTS)
              const recommendation = pickRecommendation(book, lang)
              return (
                <BookCard
                  key={book.id}
                  book={book}
                  locked={locked}
                  gradient={gradient}
                  recommendation={recommendation}
                  categoryLabel={t(`books.categories.${book.category ?? DEFAULT_BOOK_CATEGORY}`)}
                  premiumLabel={premiumLabel}
                  readLabel={readLabel}
                  showMoreLabel={showMoreLabel}
                  showLessLabel={showLessLabel}
                  onOpen={() => router.push(`/books/${book.id}`)}
                  onUpgrade={() => router.push('/dashboard')}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

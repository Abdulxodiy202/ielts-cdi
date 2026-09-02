'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionStarsChip } from '@/components/ui/SectionStarsChip'
import { StudyPlanBackButton } from '@/components/StudyPlanBackButton'
import { articleCategoryFor, pickForToday, type ArticleCategory } from '@/lib/utils/articleCategory'
import { FilterBar, type CategoryFilter, type DifficultyFilter } from '@/components/articles/FilterBar'
import { TodaysPicks } from '@/components/articles/TodaysPicks'
import { ArticleCard, type CardArticle } from '@/components/articles/ArticleCard'
import { PremiumLockModal } from '@/components/PremiumLockModal'

const PaymentModal = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })), { ssr: false })

// Articles hub -- crackd.it uslubi.
//
// Filter mantiqi: hech qanday filter aktiv bo'lmasa (category=all,
// difficulty=any), Today's Picks + Library ikkalasi ham ko'rinadi.
// Biror filter aktiv bo'lganda ular butunlay yashiriladi va faqat
// filtered natijalar 3-ustunli grid'da ko'rsatiladi. Filter holati
// URL search params'da saqlanadi (reload'da qoladi).

interface Article extends CardArticle {
  file_url: string | null
  cover_image_url: string | null
  is_published: boolean
  description: string | null
  content: string | null
  created_at: string
}

type StarMap = Record<string, number>
type ReadMap = Record<string, boolean>

const VALID_CATEGORIES: CategoryFilter[] = ['all', 'literature', 'science', 'history', 'humanities']
const VALID_DIFFICULTIES: DifficultyFilter[] = ['any', 'easy', 'medium', 'hard']

function parseCategory(v: string | null): CategoryFilter {
  return (VALID_CATEGORIES as string[]).includes(v ?? '') ? (v as CategoryFilter) : 'all'
}
function parseDifficulty(v: string | null): DifficultyFilter {
  return (VALID_DIFFICULTIES as string[]).includes(v ?? '') ? (v as DifficultyFilter) : 'any'
}

export default function ArticlesPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [stars, setStars] = useState<StarMap>({})
  const [readMap, setReadMap] = useState<ReadMap>({})

  // Filter holati -- URL query params bilan sync.
  const category = parseCategory(searchParams.get('category'))
  const difficulty = parseDifficulty(searchParams.get('difficulty'))

  // Study Plan'dagi vazifadan "aynan shu article'ni ishlang" deb
  // yo'naltirilganda ?highlight=<articleId> bilan keladi -- shu kartani
  // ~5 soniya glow qilib ko'rsatamiz va ko'rinadigan joyga skroll qilamiz.
  const highlightId = searchParams.get('highlight')
  const [activeHighlight, setActiveHighlight] = useState<string | null>(highlightId)

  // Premium-locked kartaga bosilganda -- endi /premium sahifasiga
  // o'tkazmaydi, shu yerda kichik modal + to'lov oynasini ochadi
  // (Reading/Listening test ro'yxatidagi oddiy pattern bilan bir xil).
  const [showLockModal, setShowLockModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const handleLockedClick = useCallback(() => setShowLockModal(true), [])
  const handleUpgradeFromLock = useCallback(() => {
    setShowLockModal(false)
    setShowPaymentModal(true)
  }, [])

  const updateFilter = useCallback(
    (nextCategory: CategoryFilter, nextDifficulty: DifficultyFilter) => {
      const p = new URLSearchParams()
      if (nextCategory !== 'all') p.set('category', nextCategory)
      if (nextDifficulty !== 'any') p.set('difficulty', nextDifficulty)
      const qs = p.toString()
      router.replace(qs ? `/articles?${qs}` : '/articles', { scroll: false })
    },
    [router],
  )

  const handleCategoryChange = useCallback(
    (v: CategoryFilter) => updateFilter(v, difficulty),
    [difficulty, updateFilter],
  )
  const handleDifficultyChange = useCallback(
    (v: DifficultyFilter) => updateFilter(category, v),
    [category, updateFilter],
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('is_premium, premium_until')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
      // "O'qilgan" = article uchun kamida 1 marta test topshirilgan.
      supabase
        .from('article_test_results')
        .select('article_id, best_stars, attempts')
        .eq('user_id', user.id)
        .then(({ data }) => {
          if (!Array.isArray(data)) return
          const smap: StarMap = {}
          const rmap: ReadMap = {}
          for (const r of data as { article_id: string; best_stars: number; attempts: number | null }[]) {
            smap[r.article_id] = r.best_stars
            if ((r.attempts ?? 0) > 0) rmap[r.article_id] = true
          }
          setStars(smap)
          setReadMap(rmap)
        })
    })
    fetch('/api/articles')
      .then(async r => {
        const d = await r.json().catch(() => [])
        if (!Array.isArray(d)) return
        setArticles(d as Article[])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!highlightId || loading) return
    const el = document.querySelector(`[data-highlight-id="${highlightId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setActiveHighlight(null), 5000)
    return () => clearTimeout(timer)
  }, [highlightId, loading])

  const lockedIds = useMemo(() => {
    const s = new Set<string>()
    if (!isPremium) {
      for (const a of articles) if (a.is_premium) s.add(a.id)
    }
    return s
  }, [articles, isPremium])

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      const matchesCategory =
        category === 'all' || articleCategoryFor(a) === (category as ArticleCategory)
      const matchesDifficulty =
        difficulty === 'any' || (a.difficulty ?? 'easy') === difficulty
      return matchesCategory && matchesDifficulty
    })
  }, [articles, category, difficulty])

  // Today's Picks: filterdan tashqari, sana bo'yicha 5 ta barqaror.
  const picks = useMemo(() => pickForToday(articles, 5), [articles])

  const sectionTotal = Object.values(stars).reduce((s, x) => s + x, 0)
  const readCount = Object.keys(readMap).length

  // Filter aktivmi? (birortasi default'dan boshqa)
  const filterActive = category !== 'all' || difficulty !== 'any'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <StudyPlanBackButton />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('articles.title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('articles.subtitle')}
          </p>
        </div>
        <div className="shrink-0">
          <SectionStarsChip total={sectionTotal} />
        </div>
      </div>

      <FilterBar
        category={category}
        difficulty={difficulty}
        onCategoryChange={handleCategoryChange}
        onDifficultyChange={handleDifficultyChange}
      />

      {articles.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4" style={{ color: 'var(--text-muted)' }}>
          <BookOpen size={48} className="opacity-20" />
          <p className="font-medium">{t('articles.empty')}</p>
        </div>
      ) : filterActive ? (
        // Filter aktiv -- Today's Picks va Library sarlavhasi yashirin.
        // Faqat filtered natijalar 3 ustunli grid'da.
        <section>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('articles.foundCount', { count: filteredArticles.length })}
          </p>

          {filteredArticles.length === 0 ? (
            <div
              className="py-12 text-center rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {t('articles.noFilterMatch')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map((a, i) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  locked={lockedIds.has(a.id)}
                  delay={0.03 * i}
                  bestStars={stars[a.id] ?? 0}
                  highlighted={activeHighlight === a.id}
                  onLockedClick={handleLockedClick}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        // Default holat: Today's Picks + Library
        <>
          <TodaysPicks picks={picks} lockedIds={lockedIds} starsMap={stars} onLockedClick={handleLockedClick} />

          <section>
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              Library
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                {readCount}/{articles.length} read
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((a, i) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  locked={lockedIds.has(a.id)}
                  delay={0.03 * i}
                  bestStars={stars[a.id] ?? 0}
                  highlighted={activeHighlight === a.id}
                  onLockedClick={handleLockedClick}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Premium lock modal -- ilova bo'yicha yagona umumiy komponent */}
      <PremiumLockModal
        open={showLockModal}
        onClose={() => setShowLockModal(false)}
        onUpgrade={handleUpgradeFromLock}
        title={t('articles.lockedTitle')}
        description={t('articles.lockedDesc')}
        cancelLabel={t('common.cancel')}
        upgradeLabel={t('common.upgradeToPremium')}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => setShowPaymentModal(false)}
        type="premium"
        amount={50000}
      />
    </div>
  )
}

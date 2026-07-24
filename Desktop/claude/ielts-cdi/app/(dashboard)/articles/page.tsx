'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionStarsChip } from '@/components/ui/SectionStarsChip'
import { StudyPlanBackButton } from '@/components/StudyPlanBackButton'
import { deriveCategory, pickForToday, type ArticleCategory } from '@/lib/utils/articleCategory'
import { FilterBar, type CategoryFilter, type DifficultyFilter } from '@/components/articles/FilterBar'
import { TodaysPicks } from '@/components/articles/TodaysPicks'
import { ArticleCard, type CardArticle } from '@/components/articles/ArticleCard'

// Articles hub -- crackd.it uslubidagi 1-bosqich. Layout:
//   1) FilterBar (kategoriya + qiyinchilik)
//   2) Today's Picks bento (1 katta + 4 kichik, kunga bog'liq)
//   3) Library grid (filter'lardan o'tgan hamma)
// Kategoriya ustuni backend'da hozircha yo'q -- deriveCategory(id)
// bilan barqaror simulyatsiya qilinadi. Backend qo'shsa fallback.

interface Article extends CardArticle {
  file_url: string | null
  cover_image_url: string | null
  is_published: boolean
  created_at: string
}

type StarMap = Record<string, number>
type ReadMap = Record<string, boolean>

export default function ArticlesPage() {
  const { t } = useLanguage()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [stars, setStars] = useState<StarMap>({})
  const [readMap, setReadMap] = useState<ReadMap>({})

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('any')

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
      // Boshqa signal yo'q -- article ochish jadvalda yozilmaydi.
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
        category === 'all' || deriveCategory(a.id) === (category as ArticleCategory)
      const matchesDifficulty =
        difficulty === 'any' || (a.difficulty ?? 'easy') === difficulty
      return matchesCategory && matchesDifficulty
    })
  }, [articles, category, difficulty])

  // Today's Picks: filterdan tashqari, sana bo'yicha 5 ta barqaror.
  const picks = useMemo(() => pickForToday(articles, 5), [articles])

  const sectionTotal = Object.values(stars).reduce((s, x) => s + x, 0)
  const readCount = Object.keys(readMap).length

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
        onCategoryChange={setCategory}
        onDifficultyChange={setDifficulty}
      />

      {articles.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4" style={{ color: 'var(--text-muted)' }}>
          <BookOpen size={48} className="opacity-20" />
          <p className="font-medium">{t('articles.empty')}</p>
        </div>
      ) : (
        <>
          <TodaysPicks picks={picks} lockedIds={lockedIds} />

          <section>
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              Library
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                {readCount}/{articles.length} read
              </span>
            </h2>

            {filteredArticles.length === 0 ? (
              <div className="py-12 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                Bu filtrlar bo&apos;yicha article topilmadi.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map((a, i) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    locked={lockedIds.has(a.id)}
                    delay={0.03 * i}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

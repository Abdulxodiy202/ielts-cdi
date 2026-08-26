'use client'

import { FeaturedCard } from '@/components/articles/FeaturedCard'
import { SmallCard } from '@/components/articles/SmallCard'
import type { CardArticle } from '@/components/articles/ArticleCard'

interface TodaysPicksProps {
  picks: (CardArticle & { description?: string | null; content?: string | null })[]
  lockedIds?: Set<string>
  // article_id -> eng yaxshi (maksimal) yulduz. FeaturedCard/SmallCard'ga
  // shu article uchun bestStars'ni topib beramiz.
  starsMap?: Record<string, number>
}

// Today's Picks bento: chap tarafda katta karta, o'ng tarafda 2x2
// kompakt kartalar. lg dan pastda hammasi bir ustunga tushadi.
// FeaturedCard endi lg:col-span-2 emas -- tashqi grid ikki ustun,
// katta karta bittasini, o'ng grid ikkinchisini oladi.
export function TodaysPicks({ picks, lockedIds, starsMap }: TodaysPicksProps) {
  if (picks.length === 0) return null

  const [featured, ...rest] = picks
  const smallOnes = rest.slice(0, 4)

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold mb-5 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
        Today&apos;s Picks
        <span
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{ background: '#3B82F6', color: '#fff' }}
        >
          Daily
        </span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chap: katta karta -- endi tashqi ustun bo'yicha to'liq */}
        <div className="h-full">
          <FeaturedCard
            article={featured}
            description={featured.description ?? null}
            content={featured.content ?? null}
            locked={lockedIds?.has(featured.id) ?? false}
            delay={0}
            bestStars={starsMap?.[featured.id] ?? 0}
          />
        </div>

        {/* O'ng: 2x2 kompakt kartalar */}
        {smallOnes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
            {smallOnes.map((a, i) => (
              <SmallCard
                key={a.id}
                article={a}
                locked={lockedIds?.has(a.id) ?? false}
                delay={0.06 * (i + 1)}
                bestStars={starsMap?.[a.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

'use client'

import { FeaturedCard } from '@/components/articles/FeaturedCard'
import { ArticleCard, type CardArticle } from '@/components/articles/ArticleCard'

interface TodaysPicksProps {
  picks: (CardArticle & { description?: string | null })[]
  lockedIds?: Set<string>
}

// Today's Picks bento: 1 katta karta chapda (col-span-2, row-span-2)
// + o'ngida 2x2 grid to'rt kichik karta. lg dan pastda hammasi bir
// ustunga tushadi. Kamida 5 ta pick keladi; 5 dan kam bo'lsa qanday
// kelgan bo'lsa shundoq render qilinadi.
export function TodaysPicks({ picks, lockedIds }: TodaysPicksProps) {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-fr">
        <FeaturedCard
          article={featured}
          description={featured.description ?? null}
          locked={lockedIds?.has(featured.id) ?? false}
          delay={0}
        />
        {smallOnes.map((a, i) => (
          <ArticleCard
            key={a.id}
            article={a}
            locked={lockedIds?.has(a.id) ?? false}
            delay={0.06 * (i + 1)}
          />
        ))}
      </div>
    </section>
  )
}

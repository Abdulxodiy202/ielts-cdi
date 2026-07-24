'use client'

import { CATEGORY_LABEL, type ArticleCategory } from '@/lib/utils/articleCategory'

// Kategoriya + qiyinchilik filter panelida ishlatiladigan pill turi.
export type CategoryFilter = 'all' | ArticleCategory
export type DifficultyFilter = 'any' | 'easy' | 'medium' | 'hard'

interface FilterBarProps {
  category: CategoryFilter
  difficulty: DifficultyFilter
  onCategoryChange: (v: CategoryFilter) => void
  onDifficultyChange: (v: DifficultyFilter) => void
}

const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'literature', label: CATEGORY_LABEL.literature },
  { key: 'science', label: CATEGORY_LABEL.science },
  { key: 'history', label: CATEGORY_LABEL.history },
  { key: 'humanities', label: CATEGORY_LABEL.humanities },
]

const DIFFICULTY_OPTIONS: { key: DifficultyFilter; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
]

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
      style={
        active
          ? { background: '#3B82F6', color: '#fff', border: '1px solid #3B82F6' }
          : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
      }
    >
      {children}
    </button>
  )
}

export function FilterBar({ category, difficulty, onCategoryChange, onDifficultyChange }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6 mb-8">
      {/* Kategoriya pill'lari -- chap tarafda. Mobile'da 1-qator. */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORY_OPTIONS.map(opt => (
          <Pill
            key={opt.key}
            active={category === opt.key}
            onClick={() => onCategoryChange(opt.key)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>

      {/* Qiyinchilik pill'lari -- o'ng tarafda. */}
      <div className="flex items-center gap-2 flex-wrap md:shrink-0">
        {DIFFICULTY_OPTIONS.map(opt => (
          <Pill
            key={opt.key}
            active={difficulty === opt.key}
            onClick={() => onDifficultyChange(opt.key)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>
    </div>
  )
}

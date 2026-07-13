import { Star } from 'lucide-react'

// Section-level star total shown in a page header (Reading, Listening,
// Articles). NEVER combined across sections -- each page renders its
// own section's total. Filled-only single star + numeric count -- this
// is a "total earned" indicator, not the 5-slot grade badge.
interface SectionStarsChipProps {
  total: number
}

export function SectionStarsChip({ total }: SectionStarsChipProps) {
  return (
    <div
      className="inline-flex items-center rounded-full"
      style={{
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(251, 191, 36, 0.12)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        color: '#fbbf24',
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      <Star size={18} fill="#fbbf24" strokeWidth={0} />
      <span>{total}</span>
    </div>
  )
}

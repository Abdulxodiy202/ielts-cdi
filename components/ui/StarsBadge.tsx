import { Star } from 'lucide-react'

// Shared 5-slot star badge. Renders all five slots -- gold-filled for the
// earned count, dimmed-outline for the rest -- so a single glance tells
// the user how well they did. Used on the Articles hub cards, on the
// Reading/Listening test list cards, in the per-test attempts modal, and
// on the post-test result screen. Three visual variants:
//
//   * 'poster' -> absolute-positioned pill sitting on top of an image
//                 (e.g. article cover). Includes glow + backdrop-blur.
//   * 'inline' -> plain inline row of stars (e.g. table cell, result
//                 screen). No background.
//   * 'chip'   -> compact pill on a card row (e.g. test list card),
//                 sitting inline with other status pills.
export type StarsBadgeVariant = 'poster' | 'inline' | 'chip'

interface StarsBadgeProps {
  stars: number
  size?: number
  variant?: StarsBadgeVariant
}

export function StarsBadge({ stars, size = 20, variant = 'inline' }: StarsBadgeProps) {
  // Empty-star color needs to contrast with each variant's own background
  // -- white 35% only reads on the dark poster overlay; the chip and
  // inline variants sit on card/table backgrounds, so use the theme's
  // muted border color instead.
  const emptyColor = variant === 'poster' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(148, 163, 184, 0.55)'

  const containerStyle: React.CSSProperties =
    variant === 'poster'
      ? {
          position: 'absolute',
          top: 12,
          left: 12,
          gap: 3,
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.35)',
          zIndex: 2,
          pointerEvents: 'none',
        }
      : variant === 'chip'
        ? {
            gap: 2,
            padding: '3px 8px',
            background: 'rgba(251, 191, 36, 0.12)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
          }
        : { gap: 2 }

  return (
    <div className="inline-flex items-center rounded-full" style={containerStyle}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= stars
        return (
          <Star
            key={n}
            size={size}
            strokeWidth={filled ? 0 : 2}
            fill={filled ? '#fbbf24' : 'none'}
            color={filled ? '#fbbf24' : emptyColor}
          />
        )
      })}
    </div>
  )
}

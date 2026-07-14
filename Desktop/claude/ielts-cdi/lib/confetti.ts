import confetti from 'canvas-confetti'

// Approximate desktop sidebar width. Used only when no anchor is
// passed AND we're on a desktop viewport.
const SIDEBAR_WIDTH_FALLBACK = 260

// Celebration burst. Origin is placed BELOW the anchor (rect.bottom +
// gap) rather than centered on it, so the header block being
// celebrated stays visually clear -- confetti erupts around/under it
// and falls, instead of raining down on top of the "5 stars!" text.
//
// If no anchor is passed, falls back to a sidebar-adjusted x on
// desktop and a low y (0.75) so the top ~30% of the viewport stays
// clean.
//
// Two overlapping bursts (x ± 0.1) still balance across the viewport
// better than a single origin.
//
// Call discipline: 5-star wins only. Keep confetti a "you nailed it"
// signal, not a generic "you finished" one.
export function fireCelebrationConfetti(anchor?: HTMLElement | null): void {
  console.log('[confetti] fire called, anchor:', anchor)

  let originX = 0.5
  let originY = 0.75

  if (typeof window !== 'undefined') {
    let usedAnchor = false
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        originX = (rect.left + rect.width / 2) / window.innerWidth
        // Fire from a small gap below the anchor's bottom edge, capped
        // at 0.85 so particles still have room to travel outward.
        originY = Math.min(0.85, (rect.bottom + 60) / window.innerHeight)
        console.log('[confetti] using anchor origin:', originX, originY, rect)
        usedAnchor = true
      }
    }
    if (!usedAnchor) {
      const isDesktop = window.innerWidth >= 1024
      if (isDesktop) {
        originX =
          (SIDEBAR_WIDTH_FALLBACK + (window.innerWidth - SIDEBAR_WIDTH_FALLBACK) / 2) /
          window.innerWidth
      }
      console.log('[confetti] using fallback origin:', originX, originY)
    }
  }

  const base = {
    particleCount: 100,
    spread: 100,
    startVelocity: 55,
    gravity: 1.0,
    ticks: 200,
  } as const

  try {
    confetti({ ...base, origin: { x: Math.max(0, originX - 0.1), y: originY } })
    confetti({ ...base, origin: { x: Math.min(1, originX + 0.1), y: originY } })
    console.log('[confetti] fired successfully')
  } catch (err) {
    console.error('[confetti] fire failed:', err)
  }
}

// Back-compat wrapper for older imports; delegates with no anchor.
export function fireCenteredConfetti(): void {
  fireCelebrationConfetti()
}

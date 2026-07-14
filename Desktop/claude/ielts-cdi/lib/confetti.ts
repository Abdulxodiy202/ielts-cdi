import confetti from 'canvas-confetti'

// Approximate desktop sidebar width. Used only when no anchor is
// passed AND we're on a desktop viewport.
const SIDEBAR_WIDTH_FALLBACK = 260

// Centered celebration burst. Two overlapping bursts feel more balanced
// than one -- a single burst reads as lopsided even at x=0.5 because
// the spread angle isn't perfectly symmetric.
//
// This function NEVER returns early: if the anchor is null / unmounted
// / zero-size, it uses a sidebar-adjusted fallback for x. That way a
// missed ref just misplaces the burst slightly instead of silently
// swallowing the whole celebration.
//
// Call discipline: 5-star wins only. Keep confetti a "you nailed it"
// signal, not a generic "you finished" one.
export function fireCelebrationConfetti(anchor?: HTMLElement | null): void {
  console.log('[confetti] fire called, anchor:', anchor)

  let originX = 0.5
  const originY = 0.55

  if (typeof window !== 'undefined') {
    let usedAnchor = false
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        originX = (rect.left + rect.width / 2) / window.innerWidth
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
    spread: 90,
    startVelocity: 45,
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

import confetti from 'canvas-confetti'

// Approximate desktop sidebar width. Used only as a fallback when no
// anchor element is passed -- normal calls should always provide an
// anchor so the bursts track the celebrated content, not the viewport.
const SIDEBAR_WIDTH_FALLBACK = 260

// Centered celebration burst. Two overlapping bursts feel more balanced
// than one -- a single burst reads as lopsided even at x=0.5 because
// the spread angle isn't perfectly symmetric.
//
// Pass an `anchor` element (typically the ref of the celebration card /
// toast) and the origin is computed from its screen position, so the
// bursts land over the CONTENT area regardless of sidebar width or a
// hidden sidebar on mobile. Without an anchor, falls back to a
// sidebar-adjusted viewport heuristic.
//
// Call discipline: 5-star wins only. Keep confetti a "you nailed it"
// signal, not a generic "you finished" one.
export function fireCelebrationConfetti(anchor?: HTMLElement | null): void {
  let originX = 0.5
  let originY = 0.55

  if (typeof window !== 'undefined') {
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      // Guard against a zero-size anchor (element not yet laid out)
      // by falling through to the viewport heuristic below.
      if (rect.width > 0 && rect.height > 0) {
        originX = (rect.left + rect.width / 2) / window.innerWidth
        originY = (rect.top + rect.height / 2) / window.innerHeight
      } else {
        originX = (SIDEBAR_WIDTH_FALLBACK + (window.innerWidth - SIDEBAR_WIDTH_FALLBACK) / 2) / window.innerWidth
      }
    } else {
      originX = (SIDEBAR_WIDTH_FALLBACK + (window.innerWidth - SIDEBAR_WIDTH_FALLBACK) / 2) / window.innerWidth
    }
  }

  const base = {
    particleCount: 100,
    spread: 90,
    startVelocity: 45,
  } as const
  confetti({ ...base, origin: { x: Math.max(0, originX - 0.1), y: originY } })
  confetti({ ...base, origin: { x: Math.min(1, originX + 0.1), y: originY } })
}

// Kept for backward compatibility -- delegates to the anchor-aware
// helper with no anchor (uses the sidebar-adjusted heuristic).
export function fireCenteredConfetti(): void {
  fireCelebrationConfetti()
}

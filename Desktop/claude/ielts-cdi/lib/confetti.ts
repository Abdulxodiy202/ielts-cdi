import confetti from 'canvas-confetti'

// Centered celebration burst. Two overlapping bursts a bit left and a
// bit right of viewport-center feel more balanced than a single origin
// -- a single burst tends to feel lopsided even at x=0.5 because the
// spread angle isn't symmetric on all screens. y=0.55 puts the origin
// just below the vertical midline so particles rise to eye level
// before falling.
//
// Call sites: only for 5-star wins (Reading/Listening celebration
// toast, Script Practice 5-star result). Keep the trigger discipline
// -- confetti is a "you nailed it" moment, not a "you finished" moment.
export function fireCenteredConfetti(): void {
  const base = {
    particleCount: 100,
    spread: 90,
    startVelocity: 45,
  } as const
  confetti({ ...base, origin: { x: 0.4, y: 0.55 } })
  confetti({ ...base, origin: { x: 0.6, y: 0.55 } })
}

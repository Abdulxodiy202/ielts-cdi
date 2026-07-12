// Shared 5-tier star grading. Full score = 5 stars; each miss drops one
// tier down to 1 star at (total - 4); anything worse is 0. Used by the
// Article Test flow and available for future score-based features.
export function calcStarsFromScore(score: number, total: number): number {
  const gap = total - score
  if (gap === 0) return 5
  if (gap === 1) return 4
  if (gap === 2) return 3
  if (gap === 3) return 2
  if (gap === 4) return 1
  return 0
}

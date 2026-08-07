// Shared star grading helpers. Two mappers so the domain-specific curve
// stays close to the code that uses it: quiz-style N-of-M grades ladder
// from full score, IELTS band scores ladder from the band boundaries.

// 5-tier ladder from a perfect score. Full = 5, each miss drops one tier,
// down to 1 star at (total - 4). Used by the Article Test flow.
export function calcStarsFromScore(score: number, total: number): number {
  const gap = total - score
  if (gap === 0) return 5
  if (gap === 1) return 4
  if (gap === 2) return 3
  if (gap === 3) return 2
  if (gap === 4) return 1
  return 0
}

// IELTS band -> stars. Boundaries match the standard band cut-offs used
// across the platform. Used by Reading + Listening tests.
export function calcStarsFromBand(band: number): number {
  if (band >= 8.5) return 5
  if (band >= 8.0) return 4
  if (band >= 7.0) return 3
  if (band >= 6.5) return 2
  if (band >= 6.0) return 1
  return 0
}

// Accuracy percentage (0-100) -> stars. Used by Script Practice.
// scriptGrading.getStars() delegates here so the mapping is defined
// once and stays consistent between what's saved and what's displayed.
export function calcStarsFromAccuracy(accuracy: number): number {
  if (accuracy >= 95) return 5
  if (accuracy >= 85) return 4
  if (accuracy >= 75) return 3
  if (accuracy >= 65) return 2
  if (accuracy >= 50) return 1
  return 0
}

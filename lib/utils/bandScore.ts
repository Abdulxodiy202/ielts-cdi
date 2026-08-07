export function calculateBandScore(rawScore: number): number {
  if (rawScore >= 39) return 9
  if (rawScore >= 37) return 8.5
  if (rawScore >= 35) return 8
  if (rawScore >= 33) return 7.5
  if (rawScore >= 30) return 7
  if (rawScore >= 27) return 6.5
  if (rawScore >= 23) return 6
  if (rawScore >= 19) return 5.5
  if (rawScore >= 15) return 5
  if (rawScore >= 13) return 4.5
  if (rawScore >= 10) return 4
  return 3.5
}

export function getBandColor(band: number): string {
  if (band >= 8) return '#22c55e'
  if (band >= 7) return '#3b82f6'
  if (band >= 6) return '#f59e0b'
  if (band >= 5) return '#f97316'
  return '#ef4444'
}

export function getBandLabel(band: number): string {
  if (band >= 8.5) return 'Expert'
  if (band >= 7) return 'Good'
  if (band >= 5.5) return 'Competent'
  if (band >= 4) return 'Limited'
  return 'Extremely Limited'
}

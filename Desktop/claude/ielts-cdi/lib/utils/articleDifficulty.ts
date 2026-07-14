// Article difficulty tiers. Green/amber/red palette, mirrored across
// the /articles hub buttons and the in-test difficulty pill. NULL is
// treated as 'easy' so articles without a difficulty set yet still
// render with a coherent color instead of falling to a default gray.
export type Difficulty = 'easy' | 'medium' | 'hard'

interface DifficultyColors {
  accent: string
  accentBg: string
  accentBorder: string
}

export function difficultyColor(difficulty: string | null | undefined): DifficultyColors {
  switch (difficulty) {
    case 'hard':
      return {
        accent: '#ef4444',
        accentBg: 'rgba(239, 68, 68, 0.15)',
        accentBorder: 'rgba(239, 68, 68, 0.4)',
      }
    case 'medium':
      return {
        accent: '#f59e0b',
        accentBg: 'rgba(245, 158, 11, 0.15)',
        accentBorder: 'rgba(245, 158, 11, 0.4)',
      }
    case 'easy':
    default:
      return {
        accent: '#10b981',
        accentBg: 'rgba(16, 185, 129, 0.15)',
        accentBorder: 'rgba(16, 185, 129, 0.4)',
      }
  }
}

// i18n key for the label shown inside the test's difficulty pill.
// (Cards deliberately omit the label -- color alone is the cue.)
export function difficultyLabelKey(difficulty: string | null | undefined): string {
  switch (difficulty) {
    case 'hard':   return 'articles.difficulty.hard'
    case 'medium': return 'articles.difficulty.medium'
    case 'easy':
    default:       return 'articles.difficulty.easy'
  }
}

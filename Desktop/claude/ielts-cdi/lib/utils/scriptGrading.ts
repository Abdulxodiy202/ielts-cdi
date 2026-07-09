/* Script Practice grading: normalize both texts into word lists, classify
   each user/original word pair as exact/partial/none (typo-tolerant via
   Levenshtein distance), then align the two word sequences IN ORDER with a
   weighted LCS so a matched word can't jump to an unrelated position later
   in the transcript. */

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[''']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[—–\-]/g, ' ')
    .replace(/['".,?!:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 0)
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = []
  for (let i = 0; i <= m; i++) {
    dp.push(new Array(n + 1).fill(0))
    dp[i][0] = i
  }
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export type MatchLevel = 'exact' | 'partial' | 'none'

export function compareWords(user: string, orig: string): MatchLevel {
  if (user === orig) return 'exact'

  // Partial match requires both words to be at least 4 chars
  if (user.length < 4 || orig.length < 4) return 'none'

  const dist = levenshtein(user, orig)
  const maxLen = Math.max(user.length, orig.length)

  // Rules for partial match:
  // - 4-5 char words: allow 1 char difference
  // - 6+ char words: allow 2 char difference
  // AND the difference must be less than 30% of word length
  let allowedDistance = 1
  if (maxLen >= 6) allowedDistance = 2

  if (dist <= allowedDistance && dist / maxLen < 0.3) {
    return 'partial'
  }
  return 'none'
}

export interface AlignItem {
  orig: string | null
  user: string | null
  status: 'exact' | 'partial' | 'missing' | 'extra'
}

export interface AlignmentStats {
  totalOrig: number
  totalUser: number
  exact: number
  partial: number
  missing: number
  extra: number
}

export interface AlignmentResult {
  alignment: AlignItem[]
  accuracy: number
  stats: AlignmentStats
}

export function computeAlignment(userText: string, origText: string): AlignmentResult {
  const userWords = normalize(userText)
  const origWords = normalize(origText)
  const m = origWords.length
  const n = userWords.length

  // DP table
  const dp: number[][] = []
  for (let i = 0; i <= m; i++) {
    dp.push(new Array(n + 1).fill(0))
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = compareWords(userWords[j - 1], origWords[i - 1])
      if (match === 'exact') {
        dp[i][j] = dp[i - 1][j - 1] + 2
      } else if (match === 'partial') {
        dp[i][j] = Math.max(
          dp[i - 1][j - 1] + 1, // partial match takes this position
          dp[i - 1][j],         // skip original word (missing)
          dp[i][j - 1],         // skip user word (extra)
        )
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack for detailed alignment
  const alignment: AlignItem[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    const match = compareWords(userWords[j - 1], origWords[i - 1])
    if (match === 'exact' && dp[i][j] === dp[i - 1][j - 1] + 2) {
      alignment.unshift({ orig: origWords[i - 1], user: userWords[j - 1], status: 'exact' })
      i--; j--
    } else if (match === 'partial' && dp[i][j] === dp[i - 1][j - 1] + 1) {
      alignment.unshift({ orig: origWords[i - 1], user: userWords[j - 1], status: 'partial' })
      i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      alignment.unshift({ orig: origWords[i - 1], user: null, status: 'missing' })
      i--
    } else {
      alignment.unshift({ orig: null, user: userWords[j - 1], status: 'extra' })
      j--
    }
  }
  while (i > 0) {
    alignment.unshift({ orig: origWords[i - 1], user: null, status: 'missing' })
    i--
  }
  while (j > 0) {
    alignment.unshift({ orig: null, user: userWords[j - 1], status: 'extra' })
    j--
  }

  // Calculate score
  const exactCount = alignment.filter(a => a.status === 'exact').length
  const partialCount = alignment.filter(a => a.status === 'partial').length
  const missingCount = alignment.filter(a => a.status === 'missing').length
  const extraCount = alignment.filter(a => a.status === 'extra').length

  // Exact = 1.0 weight, partial = 0.6 weight
  const score = exactCount + partialCount * 0.6
  const accuracy = origWords.length > 0 ? Math.round((score / origWords.length) * 100) : 0

  // eslint-disable-next-line no-console
  console.log('=== SCRIPT CHECK DEBUG ===')
  // eslint-disable-next-line no-console
  console.log('User words:', userWords.length, userWords.slice(0, 20))
  // eslint-disable-next-line no-console
  console.log('Orig words:', origWords.length, origWords.slice(0, 20))
  // eslint-disable-next-line no-console
  console.log('Exact:', exactCount, 'Partial:', partialCount, 'Missing:', missingCount, 'Extra:', extraCount)
  // eslint-disable-next-line no-console
  console.log('Score:', score, '/ Denominator:', origWords.length)
  // eslint-disable-next-line no-console
  console.log('Accuracy:', accuracy, '% -> Stars:', getStars(accuracy))
  // eslint-disable-next-line no-console
  console.log('=== END DEBUG ===')

  return {
    alignment,
    accuracy,
    stats: {
      totalOrig: origWords.length,
      totalUser: userWords.length,
      exact: exactCount,
      partial: partialCount,
      missing: missingCount,
      extra: extraCount,
    },
  }
}

export function getStars(accuracy: number): number {
  if (accuracy >= 90) return 5
  if (accuracy >= 80) return 4
  if (accuracy >= 70) return 3
  if (accuracy >= 60) return 2
  if (accuracy >= 50) return 1
  return 0
}

export const PASS_THRESHOLD = 70

export function isPassed(accuracy: number): boolean {
  return accuracy >= PASS_THRESHOLD
}

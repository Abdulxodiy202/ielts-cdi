/* Script Practice grading: normalize both texts into word lists, then
   compare STRICTLY BY POSITION -- user word i vs. original word i, never
   searching ahead. An LCS-style alignment was tried before this, but LCS
   finds matching words anywhere (as long as their relative order holds),
   which lets a user who happens to type real words that occur later in
   the transcript get credited as if they'd transcribed the right part.
   For a dictation exercise, position IS the point: you're reconstructing
   what was said in the order it was said, not producing a word salad
   drawn from the passage. Within a position, small typos are still
   forgiven via compareWords()'s Levenshtein-based partial match. */

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

  const maxLen = Math.max(user.length, orig.length)
  const dist = levenshtein(user, orig)

  // Skip very short words (1-2 chars) — too easy to match wrong
  if (maxLen < 3) return 'none'

  // Determine allowed distance based on word length
  let allowedDistance: number
  if (maxLen === 3) allowedDistance = 1        // 3 chars: 1 diff (e.g. "bbs" -> "bbc")
  else if (maxLen <= 5) allowedDistance = 1    // 4-5 chars: 1 diff
  else if (maxLen <= 8) allowedDistance = 2    // 6-8 chars: 2 diff
  else allowedDistance = 3                     // 9+ chars: 3 diff

  // Also require diff to be < 40% of word length
  if (dist <= allowedDistance && dist / maxLen < 0.4) {
    return 'partial'
  }
  return 'none'
}

export interface AlignItem {
  orig: string | null
  user: string | null
  status: 'exact' | 'partial' | 'wrong' | 'missing' | 'extra'
}

export interface AlignmentStats {
  totalOrig: number
  totalUser: number
  exact: number
  partial: number
  wrong: number
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

  const alignment: AlignItem[] = []
  const maxLen = Math.max(userWords.length, origWords.length)

  let exactCount = 0
  let partialCount = 0
  let missingCount = 0
  let extraCount = 0

  for (let i = 0; i < maxLen; i++) {
    const userWord = userWords[i]
    const origWord = origWords[i]

    if (userWord === undefined) {
      // User didn't type this position — missing
      alignment.push({ orig: origWord, user: null, status: 'missing' })
      missingCount++
    } else if (origWord === undefined) {
      // User typed extra words past the end of the original — extra
      alignment.push({ orig: null, user: userWord, status: 'extra' })
      extraCount++
    } else {
      // Both words exist at position i — compare
      const match = compareWords(userWord, origWord)
      if (match === 'exact') {
        alignment.push({ orig: origWord, user: userWord, status: 'exact' })
        exactCount++
      } else if (match === 'partial') {
        alignment.push({ orig: origWord, user: userWord, status: 'partial' })
        partialCount++
      } else {
        // Different word at this position — the right word wasn't typed
        // AND a wrong one was, so it's neither a plain "missing" nor a
        // plain "extra": it gets its own status.
        alignment.push({ orig: origWord, user: userWord, status: 'wrong' })
      }
    }
  }

  const wrongCount = alignment.filter(a => a.status === 'wrong').length

  // Exact = 1.0 weight, partial = 0.6 weight
  const score = exactCount + partialCount * 0.6
  const accuracy = origWords.length > 0 ? Math.round((score / origWords.length) * 100) : 0

  /* eslint-disable no-console */
  console.log('=== POSITION MATCHING DEBUG ===')
  console.log('User words:', userWords.length)
  console.log('Orig words:', origWords.length)
  console.log('Position 0: user =', userWords[0], '| orig =', origWords[0])
  console.log('Position 1: user =', userWords[1], '| orig =', origWords[1])
  console.log('Position 2: user =', userWords[2], '| orig =', origWords[2])
  console.log('Position 3: user =', userWords[3], '| orig =', origWords[3])
  console.log('Position 4: user =', userWords[4], '| orig =', origWords[4])
  console.log('Exact:', exactCount, '| Partial:', partialCount,
    '| Wrong:', wrongCount, '| Missing:', missingCount,
    '| Extra:', extraCount)
  console.log('Accuracy:', accuracy, '%')
  /* eslint-enable no-console */

  return {
    alignment,
    accuracy,
    stats: {
      totalOrig: origWords.length,
      totalUser: userWords.length,
      exact: exactCount,
      partial: partialCount,
      wrong: wrongCount,
      missing: missingCount,
      extra: extraCount,
    },
  }
}

// Kept for callers that already import from scriptGrading; delegates to
// the shared lib/stars mapping so we never diverge from what other
// features use.
import { calcStarsFromAccuracy } from '@/lib/stars'
export function getStars(accuracy: number): number {
  return calcStarsFromAccuracy(accuracy)
}

export const PASS_THRESHOLD = 70

export function isPassed(accuracy: number): boolean {
  return accuracy >= PASS_THRESHOLD
}

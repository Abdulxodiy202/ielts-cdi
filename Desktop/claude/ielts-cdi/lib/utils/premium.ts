/**
 * Returns true only when the user has an active, unexpired premium subscription.
 *
 * Rules:
 *  - is_premium must be true
 *  - premium_until must be set (null → not premium)
 *  - premium_until must be in the future
 */
export function isActivePremium(
  profile:
    | { is_premium: boolean; premium_until: string | null }
    | null
    | undefined
): boolean {
  if (!profile?.is_premium) return false
  if (!profile.premium_until) return false
  return new Date(profile.premium_until) > new Date()
}

/**
 * Returns a Date exactly 1 calendar month from now.
 * Uses setMonth() so Feb 28 → Mar 28, etc.
 */
export function oneMonthFromNow(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d
}

import type { SupabaseClient } from '@supabase/supabase-js'

export const GAME_ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'
const TASHKENT_TZ = 'Asia/Tashkent'

/** Today's date (YYYY-MM-DD) in Asia/Tashkent (fixed UTC+5, no DST). */
export function getTashkentDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TASHKENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** ISO datetime of the next 00:00 in Asia/Tashkent, for the reset countdown. */
export function getNextTashkentMidnightISO(): string {
  const [y, m, d] = getTashkentDate().split('-').map(Number)
  // Tomorrow 00:00 +05:00 == tomorrow 00:00 UTC minus 5 hours.
  const tomorrowMidnightUTC = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 5 * 60 * 60 * 1000
  return new Date(tomorrowMidnightUTC).toISOString()
}

export type UnlockReason =
  | 'admin_bypass'
  | 'already_unlocked'
  | 'daily_limit_reached'
  | 'previous_level_locked'
  | 'ok'

export interface UnlockCheck {
  canUnlock: boolean
  reason: UnlockReason
  unlockedToday: number
  dailyLimit: number
}

export function getDailyLimit(isPremium: boolean): number {
  return isPremium ? 4 : 1
}

/**
 * Determines whether `levelNumber` is accessible for this user right now.
 * Levels the user already has ANY game_progress row for (completed or a
 * past incomplete attempt) are always replayable and never count against
 * the daily limit — only advancing into a level with no prior row does.
 */
export async function canUnlockLevel(
  admin: SupabaseClient,
  userId: string,
  levelNumber: number,
  isPremium: boolean,
  userEmail: string | null | undefined,
): Promise<UnlockCheck> {
  const dailyLimit = getDailyLimit(isPremium)

  if (userEmail === GAME_ADMIN_EMAIL) {
    return { canUnlock: true, reason: 'admin_bypass', unlockedToday: 0, dailyLimit: 999 }
  }

  if (levelNumber === 1) {
    return { canUnlock: true, reason: 'ok', unlockedToday: 0, dailyLimit }
  }

  const { data: existingProgress } = await admin
    .from('game_progress')
    .select('level_number')
    .eq('user_id', userId)
    .eq('level_number', levelNumber)
    .maybeSingle()

  if (existingProgress) {
    return { canUnlock: true, reason: 'already_unlocked', unlockedToday: 0, dailyLimit }
  }

  const { data: prevProgress } = await admin
    .from('game_progress')
    .select('is_completed')
    .eq('user_id', userId)
    .eq('level_number', levelNumber - 1)
    .maybeSingle()

  if (!prevProgress?.is_completed) {
    return { canUnlock: false, reason: 'previous_level_locked', unlockedToday: 0, dailyLimit }
  }

  const today = getTashkentDate()
  const { data: todayUnlocks } = await admin
    .from('user_daily_unlocks')
    .select('levels_unlocked_today')
    .eq('user_id', userId)
    .eq('unlock_date', today)
    .maybeSingle()

  const unlockedToday = todayUnlocks?.levels_unlocked_today ?? 0

  if (unlockedToday >= dailyLimit) {
    return { canUnlock: false, reason: 'daily_limit_reached', unlockedToday, dailyLimit }
  }

  return { canUnlock: true, reason: 'ok', unlockedToday, dailyLimit }
}

/** Call once when a level transitions to completed for the first time. */
export async function recordLevelUnlock(
  admin: SupabaseClient,
  userId: string,
  userEmail: string | null | undefined,
): Promise<void> {
  if (userEmail === GAME_ADMIN_EMAIL) return

  const today = getTashkentDate()
  const { data: existing } = await admin
    .from('user_daily_unlocks')
    .select('id, levels_unlocked_today')
    .eq('user_id', userId)
    .eq('unlock_date', today)
    .maybeSingle()

  if (existing) {
    await admin
      .from('user_daily_unlocks')
      .update({ levels_unlocked_today: existing.levels_unlocked_today + 1 })
      .eq('id', existing.id)
  } else {
    await admin
      .from('user_daily_unlocks')
      .insert({ user_id: userId, unlock_date: today, levels_unlocked_today: 1 })
  }
}

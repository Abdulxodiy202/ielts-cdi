import type { SupabaseClient } from '@supabase/supabase-js'

export type StarCategory = 'reading' | 'listening' | 'script' | 'article' | 'video' | 'game'

/**
 * Grants leaderboard points via the increment_user_stars RPC.
 *
 * ALWAYS pass a DELTA (new best minus previous best), never the raw
 * attempt stars -- retakes must not inflate totals. Callers compute the
 * delta against their feature's own best-tracking row (test_results max,
 * article/video_test_results.best_stars, script_progress.best_stars,
 * game_progress.stars) and this helper no-ops on delta <= 0.
 *
 * Best-effort by design: a leaderboard hiccup must never fail the
 * user-facing save that triggered it, so errors are logged and swallowed.
 */
export async function grantLeaderboardStars(
  client: SupabaseClient,
  userId: string,
  category: StarCategory,
  delta: number,
): Promise<void> {
  if (!Number.isFinite(delta) || delta <= 0) return
  try {
    const { error } = await client.rpc('increment_user_stars', {
      p_user_id: userId,
      p_category: category,
      p_stars: Math.round(delta),
    })
    if (error) console.error('[leaderboard] increment_user_stars failed:', category, error.message)
  } catch (e) {
    console.error('[leaderboard] increment_user_stars threw:', category, e)
  }
}

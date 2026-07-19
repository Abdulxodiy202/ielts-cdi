import type { SupabaseClient } from '@supabase/supabase-js'

// Study Plan client/server helpers. Backend tables + RPCs already exist
// (user_plan_settings, user_study_plans, user_login_streak,
// user_streak_bonuses; generate_weekly_plan / update_plan_progress /
// record_meaningful_activity). Everything here is best-effort: a plan
// bookkeeping failure must never break the user-facing save that
// triggered it.

export type PlanCategory = 'reading' | 'listening' | 'script' | 'vocab' | 'article' | 'video'

export interface StudyPlan {
  id: string
  user_id: string
  mode: 'weekly' | 'daily'
  period_start: string
  period_end: string
  reading_test_ids: string[] | null
  reading_retry_ids: string[] | null
  listening_test_ids: string[] | null
  listening_retry_ids: string[] | null
  script_target: number
  vocab_target: number
  article_target: number
  video_target: number
  typing_minutes_target: number
  reading_completed: number
  listening_completed: number
  script_completed: number
  vocab_completed: number
  article_completed: number
  video_completed: number
  typing_minutes_completed: number
  is_completed: boolean
  bonus_awarded: boolean
  created_at: string
  completed_at: string | null
}

/** Latest plan whose period hasn't ended (completed plans included so
    the UI can show the finished state + celebration). */
export async function fetchActivePlan(client: SupabaseClient, userId: string): Promise<StudyPlan | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await client
    .from('user_study_plans')
    .select('*')
    .eq('user_id', userId)
    .gte('period_end', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as StudyPlan | null) ?? null
}

/** Fire the update_plan_progress RPC. Server routes call this after
    their existing writes; errors are logged and swallowed. */
export async function bumpPlanProgress(
  client: SupabaseClient,
  userId: string,
  category: PlanCategory,
): Promise<void> {
  try {
    const { error } = await client.rpc('update_plan_progress', {
      p_user_id: userId,
      p_category: category,
    })
    if (error) console.error('[study-plan] update_plan_progress failed:', category, error.message)
  } catch (e) {
    console.error('[study-plan] update_plan_progress threw:', category, e)
  }
}

/** Client-side variant that also reports whether this bump just pushed
    the plan to completion (completed within the last minute), so result
    screens can fire the celebration. */
export async function bumpPlanProgressAndCheck(
  client: SupabaseClient,
  userId: string,
  category: PlanCategory,
): Promise<{ justCompleted: boolean }> {
  await bumpPlanProgress(client, userId, category)
  try {
    const plan = await fetchActivePlan(client, userId)
    if (plan?.is_completed && plan.completed_at) {
      const ageMs = Date.now() - new Date(plan.completed_at).getTime()
      return { justCompleted: ageMs >= 0 && ageMs < 60_000 }
    }
  } catch { /* best-effort */ }
  return { justCompleted: false }
}

/** Typing tracks minutes rather than counts. Adds `minutes` to the
    active plan's typing_minutes_completed and records meaningful
    activity for the login streak when the session was >= 15s. */
export async function recordTypingMinutes(
  client: SupabaseClient,
  userId: string,
  minutes: number,
): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  try {
    const plan = await fetchActivePlan(client, userId)
    if (plan && plan.typing_minutes_target > 0) {
      await client
        .from('user_study_plans')
        .update({ typing_minutes_completed: (plan.typing_minutes_completed ?? 0) + Math.round(minutes) })
        .eq('id', plan.id)
    }
    if (minutes >= 0.25) {
      await client.rpc('record_meaningful_activity', { p_user_id: userId })
    }
  } catch (e) {
    console.error('[study-plan] recordTypingMinutes failed:', e)
  }
}

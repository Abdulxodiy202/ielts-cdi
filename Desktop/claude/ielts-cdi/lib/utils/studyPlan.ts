import type { SupabaseClient } from '@supabase/supabase-js'
import { getTashkentToday } from '@/lib/utils/date'

// Study Plan client/server helpers. Backend tables + RPCs already exist
// (user_plan_settings, user_study_plans, user_login_streak,
// user_streak_bonuses; generate_weekly_plan / generate_plan_for_user /
// generate_free_daily_plan / update_plan_progress /
// record_meaningful_activity). Everything here is best-effort: a plan
// bookkeeping failure must never break the user-facing save that
// triggered it.

export type PlanCategory = 'reading' | 'listening' | 'script' | 'vocab' | 'article' | 'video'

// The active plan can be one of: legacy weekly, legacy daily (premium),
// free daily (7-day trial), free daily locked (week 2+ upsell).
export type PlanMode = 'weekly' | 'daily' | 'daily_free' | 'daily_free_locked'

export interface StudyPlan {
  id: string
  user_id: string
  mode: PlanMode
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

const COMPLETED_COL: Record<PlanCategory, keyof StudyPlan> = {
  reading:   'reading_completed',
  listening: 'listening_completed',
  script:    'script_completed',
  vocab:     'vocab_completed',
  article:   'article_completed',
  video:     'video_completed',
}

function totalTarget(plan: StudyPlan): number {
  const rTotal = (plan.reading_test_ids?.length ?? 0) + (plan.reading_retry_ids?.length ?? 0)
  const lTotal = (plan.listening_test_ids?.length ?? 0) + (plan.listening_retry_ids?.length ?? 0)
  return rTotal + lTotal + plan.script_target + plan.vocab_target + plan.article_target + plan.video_target
}

function totalDone(plan: StudyPlan): number {
  const rTotal = (plan.reading_test_ids?.length ?? 0) + (plan.reading_retry_ids?.length ?? 0)
  const lTotal = (plan.listening_test_ids?.length ?? 0) + (plan.listening_retry_ids?.length ?? 0)
  return Math.min(plan.reading_completed, rTotal)
    + Math.min(plan.listening_completed, lTotal)
    + Math.min(plan.script_completed, plan.script_target)
    + Math.min(plan.vocab_completed, plan.vocab_target)
    + Math.min(plan.article_completed, plan.article_target)
    + Math.min(plan.video_completed, plan.video_target)
}

/** Latest plan whose period hasn't ended (completed plans included so
    the UI can show the finished state + celebration). */
export async function fetchActivePlan(client: SupabaseClient, userId: string): Promise<StudyPlan | null> {
  const today = getTashkentToday()
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

/** Today's free-daily plan (either 'daily_free' or its post-week-1
    'daily_free_locked' twin). Separate from fetchActivePlan so the
    daily UI can render even when a legacy weekly plan also exists. */
export async function fetchTodayDailyFreePlan(
  client: SupabaseClient,
  userId: string,
): Promise<StudyPlan | null> {
  const today = getTashkentToday()
  const { data } = await client
    .from('user_study_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('period_start', today)
    .in('mode', ['daily_free', 'daily_free_locked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as StudyPlan | null) ?? null
}

/** Update the matching completed counter on today's daily_free plan
    row and, if this bump just finished it, mark it completed and grant
    the +15 bonus (once, guarded by bonus_awarded). Safe to call for
    users with no daily_free plan -- returns early. */
async function bumpDailyFreePlan(
  client: SupabaseClient,
  userId: string,
  category: PlanCategory,
): Promise<void> {
  try {
    const plan = await fetchTodayDailyFreePlan(client, userId)
    // Only bump plans that haven't hit the wall yet and where this
    // category is actually part of today's targets.
    if (!plan || plan.mode !== 'daily_free' || plan.is_completed) return

    const col = COMPLETED_COL[category]
    const currentValue = (plan[col] as number | null) ?? 0
    let cap: number
    if (category === 'reading')      cap = plan.reading_test_ids?.length   ?? 0
    else if (category === 'listening') cap = plan.listening_test_ids?.length ?? 0
    else if (category === 'script')  cap = plan.script_target
    else if (category === 'vocab')   cap = plan.vocab_target
    else if (category === 'article') cap = plan.article_target
    else                              cap = plan.video_target
    if (cap <= 0 || currentValue >= cap) return

    const nextValue = currentValue + 1
    const { data: updated } = await client
      .from('user_study_plans')
      .update({ [col]: nextValue })
      .eq('id', plan.id)
      .select('*')
      .single()

    const post = (updated as StudyPlan | null) ?? { ...plan, [col]: nextValue } as StudyPlan
    if (totalTarget(post) > 0 && totalDone(post) >= totalTarget(post) && !post.bonus_awarded) {
      await client
        .from('user_study_plans')
        .update({ is_completed: true, bonus_awarded: true, completed_at: new Date().toISOString() })
        .eq('id', plan.id)
      // +15 bonus to user_stars_total via the same category that just
      // triggered completion -- there's no separate "bonus" bucket.
      await client.rpc('increment_user_stars', {
        p_user_id: userId,
        p_category: category,
        p_stars: 15,
      })
    }
  } catch (e) {
    console.error('[study-plan] bumpDailyFreePlan failed:', category, e)
  }
}

/** Fire the update_plan_progress RPC AND directly bump today's
    daily_free plan row (the RPC only covers the legacy weekly plan).
    Server routes call this after their existing writes; errors are
    logged and swallowed. */
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
  // Independent from the RPC -- the free daily plan has its own row and
  // is not driven by update_plan_progress.
  await bumpDailyFreePlan(client, userId, category)
}

/** Client-side variant that also reports whether this bump just pushed
    the active plan to completion (completed within the last minute),
    so result screens can fire the celebration. Checks both the legacy
    active plan and today's daily_free plan. */
export async function bumpPlanProgressAndCheck(
  client: SupabaseClient,
  userId: string,
  category: PlanCategory,
): Promise<{ justCompleted: boolean }> {
  await bumpPlanProgress(client, userId, category)
  try {
    const [active, daily] = await Promise.all([
      fetchActivePlan(client, userId),
      fetchTodayDailyFreePlan(client, userId),
    ])
    const candidates = [active, daily].filter(Boolean) as StudyPlan[]
    for (const p of candidates) {
      if (p.is_completed && p.completed_at) {
        const ageMs = Date.now() - new Date(p.completed_at).getTime()
        if (ageMs >= 0 && ageMs < 60_000) return { justCompleted: true }
      }
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

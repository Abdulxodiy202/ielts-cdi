export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch all test results with test info
  const { data: results, error } = await admin
    .from('test_results')
    .select('id, user_id, test_id, raw_score, band_score, time_taken, completed_at, tests!test_id(title, type)')
    .order('completed_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!results || results.length === 0) return NextResponse.json([])

  // Batch fetch user emails from auth
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of users ?? []) {
    emailMap[u.id] = u.email ?? u.id
  }

  // Batch fetch profiles for full_name and is_premium
  const userIds = [...new Set(results.map(r => r.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, is_premium')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string | null; is_premium: boolean }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = { full_name: p.full_name, is_premium: p.is_premium ?? false }
  }

  const enriched = results.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_email: emailMap[r.user_id] ?? r.user_id,
    user_name: profileMap[r.user_id]?.full_name ?? emailMap[r.user_id] ?? r.user_id,
    is_premium: profileMap[r.user_id]?.is_premium ?? false,
    test_id: r.test_id,
    test_title: (r.tests as any)?.title ?? 'Unknown',
    test_type: (r.tests as any)?.type ?? 'unknown',
    score: r.raw_score,
    band: r.band_score,
    time_taken: r.time_taken,
    completed_at: r.completed_at,
  }))

  return NextResponse.json(enriched)
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { full_name, avatar_url } = body as { full_name?: string; avatar_url?: string }

  const updates: Record<string, unknown> = {}
  if (full_name !== undefined) updates.full_name = full_name.trim() || null
  if (avatar_url !== undefined) updates.avatar_url = avatar_url

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Chain `.select().maybeSingle()` so we can distinguish a real success
  // from an RLS-blocked silent no-op -- Postgres returns no error when
  // the policy filters out the row, only an empty result set. Without
  // this the client would see "ok" and never learn the write vanished.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, avatar_url')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) {
    console.error('[profile] update returned 0 rows -- RLS or missing profile row', user.id)
    return NextResponse.json(
      { error: 'Profile row not updated (RLS block or missing profile)' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, profile: updated })
}

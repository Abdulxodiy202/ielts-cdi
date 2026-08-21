export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { full_name, avatar_url, display_name } = body as {
    full_name?: string
    avatar_url?: string
    display_name?: string
  }

  const updates: Record<string, unknown> = {}
  if (full_name !== undefined) updates.full_name = full_name.trim() || null
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  // `display_name` is the label the dashboard greeting + sidebar top
  // read from. Keeping it in sync with full_name is the caller's job --
  // this endpoint just persists whatever the payload sets.
  if (display_name !== undefined) updates.display_name = display_name.trim() || null
  // Bump updated_at so any downstream cache or realtime subscriber
  // notices the change; also matches the pattern used by the username
  // endpoint below.
  if (Object.keys(updates).length > 0) updates.updated_at = new Date().toISOString()

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
    .select('id, full_name, avatar_url, display_name')
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

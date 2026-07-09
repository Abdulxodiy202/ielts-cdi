export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: script, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !script) return Response.json({ error: 'Not found' }, { status: 404 })

  // Strategy: all scripts are free for now (see task section 11) -- is_premium
  // is kept on the row so premium gating can be enabled later without a
  // migration, but it is intentionally NOT enforced here.

  return Response.json(script)
}

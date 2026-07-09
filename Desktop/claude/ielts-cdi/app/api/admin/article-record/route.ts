export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { articleId, publicUrl } = await request.json()
  if (!articleId || !publicUrl) {
    return Response.json({ error: 'articleId va publicUrl kerak' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('articles')
    .update({ file_url: publicUrl })
    .eq('id', articleId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ url: publicUrl })
}

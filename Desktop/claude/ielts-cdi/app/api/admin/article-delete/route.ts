export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { articleId, fileName } = await request.json() as { articleId: string; fileName: string }
  if (!articleId || !fileName) {
    return Response.json({ error: 'articleId va fileName kerak' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: storageErr } = await admin.storage
    .from('articles')
    .remove([fileName])

  if (storageErr) return Response.json({ error: storageErr.message }, { status: 500 })

  const { error: updateErr } = await admin
    .from('articles')
    .update({ file_url: null })
    .eq('id', articleId)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  return Response.json({ ok: true })
}

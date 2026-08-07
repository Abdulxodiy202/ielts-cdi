export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { testId, fileName } = await request.json() as { testId: string; fileName: string }

  if (!testId || !fileName) {
    return Response.json({ error: 'testId va fileName kerak' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Delete from Storage
  const { error: storageErr } = await admin.storage
    .from('tests')
    .remove([fileName])

  if (storageErr) {
    return Response.json({ error: storageErr.message }, { status: 500 })
  }

  // Set file_url to null in tests table
  const { error: updateErr } = await admin
    .from('tests')
    .update({ file_url: null })
    .eq('id', testId)

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

// Lightweight DB-only update after a client-side Supabase Storage upload.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { testId, publicUrl, fileName } = await request.json()
  if (!testId || !publicUrl) {
    return Response.json({ error: 'testId va publicUrl kerak' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tests')
    .update({ file_url: publicUrl })
    .eq('id', testId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ url: publicUrl, fileName })
}

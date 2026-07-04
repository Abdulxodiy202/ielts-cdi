export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'mp3'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('dictation_audio')
    .upload(filename, file, { contentType: file.type })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from('dictation_audio')
    .getPublicUrl(filename)

  return Response.json({ url: publicUrl })
}

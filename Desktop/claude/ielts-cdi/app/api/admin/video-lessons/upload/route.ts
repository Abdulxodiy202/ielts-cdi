export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']
const BUCKET = 'video_lessons'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { type, fileName, contentType } = await request.json()
  if (!['video', 'poster'].includes(type)) {
    return Response.json({ error: 'type must be video or poster' }, { status: 400 })
  }

  const ext  = (fileName as string).split('.').pop()?.toLowerCase() ?? (type === 'video' ? 'mp4' : 'jpg')
  const uuid = crypto.randomUUID()
  const path = type === 'video' ? `videos/${uuid}.${ext}` : `posters/${uuid}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  return Response.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl, contentType })
}

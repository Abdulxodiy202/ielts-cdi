export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

const CONTENT_TYPES: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { articleId, fileName } = await request.json() as { articleId: string; fileName: string }
  if (!articleId || !fileName) {
    return Response.json({ error: 'articleId va fileName kerak' }, { status: 400 })
  }

  const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg'
  const storagePath = `${articleId}/cover.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('articles')
    .createSignedUploadUrl(storagePath)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('articles').getPublicUrl(storagePath)

  return Response.json({ signedUrl: data.signedUrl, contentType, publicUrl })
}

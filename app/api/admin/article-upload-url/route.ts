export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm:  'text/html; charset=utf-8',
  pdf:  'application/pdf',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { articleId, fileName } = await request.json()
  if (!articleId || !fileName) {
    return Response.json({ error: 'articleId va fileName kerak' }, { status: 400 })
  }

  const ext = (fileName.split('.').pop() ?? 'bin').toLowerCase()
  const storagePath = `${articleId}.${ext}`
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('articles')
    .createSignedUploadUrl(storagePath)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('articles').getPublicUrl(storagePath)

  return Response.json({
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath,
    contentType,
    publicUrl,
  })
}

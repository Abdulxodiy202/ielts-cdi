export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

const CONTENT_TYPES: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
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

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { articleId } = await request.json() as { articleId: string }
  if (!articleId) return Response.json({ error: 'articleId kerak' }, { status: 400 })

  const admin = createAdminClient()

  // Get current cover URL to derive storage path
  const { data: article } = await admin
    .from('articles').select('cover_image_url').eq('id', articleId).single()

  if (article?.cover_image_url) {
    try {
      const url = new URL(article.cover_image_url)
      // path is like /storage/v1/object/public/articles/{storagePath}
      const storagePath = url.pathname.split('/articles/')[1]
      if (storagePath) {
        await admin.storage.from('articles').remove([storagePath])
      }
    } catch { /* ignore parse/delete errors — still null out DB */ }
  }

  const { error } = await admin
    .from('articles').update({ cover_image_url: null }).eq('id', articleId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

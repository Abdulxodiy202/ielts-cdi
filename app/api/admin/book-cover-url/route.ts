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
  if (!user || !isAdmin(user.email)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { bookId, fileName } = await request.json() as { bookId: string; fileName: string }
  if (!bookId || !fileName) return Response.json({ error: 'bookId va fileName kerak' }, { status: 400 })

  const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg'
  const storagePath = `${bookId}/cover.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('books').createSignedUploadUrl(storagePath)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('books').getPublicUrl(storagePath)
  return Response.json({ signedUrl: data.signedUrl, contentType, publicUrl })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { bookId } = await request.json() as { bookId: string }
  if (!bookId) return Response.json({ error: 'bookId kerak' }, { status: 400 })

  const admin = createAdminClient()
  const { data: book } = await admin.from('books').select('cover_image_url').eq('id', bookId).single()

  if (book?.cover_image_url) {
    try {
      const url = new URL(book.cover_image_url)
      const storagePath = url.pathname.split('/books/')[1]
      if (storagePath) await admin.storage.from('books').remove([storagePath])
    } catch { /* ignore */ }
  }

  const { error } = await admin.from('books').update({ cover_image_url: null }).eq('id', bookId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

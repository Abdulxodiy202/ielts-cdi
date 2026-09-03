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

  const { fileName } = await request.json() as { fileName?: string }
  if (!fileName) return Response.json({ error: 'fileName kerak' }, { status: 400 })

  const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg'
  // crypto.randomUUID() -- har bir yuklashda o'ziga xos fayl nomi,
  // eski faylni tasodifan ustidan yozib qo'ymaslik uchun.
  const storagePath = `${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('landing').createSignedUploadUrl(storagePath)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('landing').getPublicUrl(storagePath)
  return Response.json({ signedUrl: data.signedUrl, contentType, publicUrl, storagePath })
}

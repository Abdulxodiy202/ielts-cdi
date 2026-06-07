export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'maxmudovamashxura71@gmail.com'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm:  'text/html; charset=utf-8',
  pdf:  'application/pdf',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  m4a:  'audio/mp4',
  zip:  'application/zip',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
}

/**
 * POST /api/admin/mock-upload
 * FormData fields:
 *   file        — the file to upload
 *   scheduleId  — UUID of the mock_schedule row (may be pre-generated client-side)
 *   fileType    — 'reading' | 'listening' | 'writing_task1'
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData  = await request.formData()
  const file       = formData.get('file')       as File | null
  const scheduleId = formData.get('scheduleId') as string | null
  const fileType   = formData.get('fileType')   as string | null

  if (!file || !scheduleId || !fileType) {
    return Response.json({ error: 'file, scheduleId va fileType kerak' }, { status: 400 })
  }

  if (!['reading', 'listening', 'writing_task1'].includes(fileType)) {
    return Response.json({ error: 'Noto\'g\'ri fileType' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType = CONTENT_TYPES[ext] ?? file.type ?? 'application/octet-stream'

  // Store in the existing "tests" bucket under mock/ subdirectory
  const storagePath = `mock/${fileType}/${scheduleId}.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('tests')
    .upload(storagePath, bytes, { contentType, upsert: true })

  if (uploadErr) {
    return Response.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('tests').getPublicUrl(storagePath)

  return Response.json({ url: publicUrl, path: storagePath, fileName: file.name })
}

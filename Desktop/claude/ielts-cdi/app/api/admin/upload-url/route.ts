export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm:  'text/html; charset=utf-8',
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip:  'application/zip',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  m4a:  'audio/mp4',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { testId, fileName } = await request.json()
  if (!testId || !fileName) {
    return Response.json({ error: 'testId va fileName kerak' }, { status: 400 })
  }

  const ext = (fileName.split('.').pop() ?? 'bin').toLowerCase()
  const storagePath = `${testId}.${ext}`
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  const admin = createAdminClient()

  // Create a signed upload URL — the browser will PUT the file directly to Supabase
  // Storage, bypassing Vercel's 4.5 MB serverless body limit entirely.
  const { data, error } = await admin.storage
    .from('tests')
    .createSignedUploadUrl(storagePath)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('tests').getPublicUrl(storagePath)

  return Response.json({
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath,
    contentType,
    publicUrl,
  })
}

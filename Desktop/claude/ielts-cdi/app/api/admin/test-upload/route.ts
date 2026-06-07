export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'maxmudovamashxura71@gmail.com'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const testId = formData.get('testId') as string

  if (!file || !testId) {
    return Response.json({ error: 'file va testId kerak' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const fileName = `${testId}.${ext}`
  const bytes = await file.arrayBuffer()

  // Always derive content-type from extension so HTML files render in iframes
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
  const contentType = CONTENT_TYPES[ext] ?? file.type ?? 'application/octet-stream'

  const admin = createAdminClient()

  // Upload (overwrite if exists)
  const { error: uploadErr } = await admin.storage
    .from('tests')
    .upload(fileName, bytes, { contentType, upsert: true })

  if (uploadErr) {
    return Response.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('tests').getPublicUrl(fileName)

  // Save URL to tests table
  const { error: updateErr } = await admin
    .from('tests')
    .update({ file_url: publicUrl })
    .eq('id', testId)

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 })
  }

  return Response.json({ url: publicUrl, fileName: file.name })
}

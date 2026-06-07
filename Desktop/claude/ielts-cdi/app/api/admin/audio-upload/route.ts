export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const testId = formData.get('testId') as string
  const sectionNumber = formData.get('sectionNumber') as string

  if (!file || !testId || !sectionNumber) {
    return Response.json({ error: 'file, testId and sectionNumber required' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() ?? 'mp3').toLowerCase()
  const fileName = `${testId}/section-${sectionNumber}.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()

  // Remove existing file if any (ignore error)
  await admin.storage.from('audio').remove([fileName])

  const { error: uploadErr } = await admin.storage
    .from('audio')
    .upload(fileName, bytes, { contentType: file.type || 'audio/mpeg', upsert: true })

  if (uploadErr) {
    return Response.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('audio').getPublicUrl(fileName)

  return Response.json({ url: publicUrl })
}

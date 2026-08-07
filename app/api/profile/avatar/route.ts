export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Rasm 2 MB dan kichik bo\'lishi kerak' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Faqat JPEG, PNG, WebP yoki GIF' }, { status: 400 })

  const admin = createAdminClient()

  // Ensure bucket exists (idempotent)
  await admin.storage.createBucket('avatars', { public: true }).catch(() => {/* already exists */})

  const ext = file.type === 'image/jpeg' ? 'jpg'
            : file.type === 'image/png'  ? 'png'
            : file.type === 'image/webp' ? 'webp'
            : 'gif'
  const path = `${user.id}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadErr } = await admin.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (uploadErr) {
    console.error('[avatar upload] storage error:', uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  // Persist URL to profile
  await admin.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

  return NextResponse.json({ publicUrl })
}

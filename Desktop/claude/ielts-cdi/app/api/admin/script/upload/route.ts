export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

const BUCKETS = { audio: 'script_audio', thumbnail: 'script_thumbnails' } as const

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { type, fileName } = await request.json()
  if (!['audio', 'thumbnail'].includes(type)) {
    return Response.json({ error: 'type must be audio or thumbnail' }, { status: 400 })
  }

  const bucket = BUCKETS[type as keyof typeof BUCKETS]
  const ext = (fileName as string).split('.').pop()?.toLowerCase() ?? (type === 'audio' ? 'mp3' : 'jpg')
  const uuid = crypto.randomUUID()
  const path = `${type}/${uuid}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)

  return Response.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl })
}

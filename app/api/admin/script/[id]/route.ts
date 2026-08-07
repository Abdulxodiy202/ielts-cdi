export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

/** Public Supabase Storage URLs look like .../object/public/{bucket}/{path} */
function storagePathFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url)
    const marker = `/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return u.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  if ('title' in body) {
    const title = String(body.title).trim()
    if (title.length < 3 || title.length > 200) {
      return Response.json({ error: 'Sarlavha 3-200 belgidan iborat bo\'lishi kerak' }, { status: 400 })
    }
    allowed.title = title
  }
  if ('description' in body) allowed.description = body.description ? String(body.description).trim() : null
  if ('thumbnail_url' in body) allowed.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url) : null
  if ('audio_url' in body) allowed.audio_url = String(body.audio_url).trim()
  if ('transcript' in body) {
    const transcript = String(body.transcript).trim()
    const wordCount = transcript.split(/\s+/).filter(Boolean).length
    if (wordCount < 50) {
      return Response.json({ error: 'Transkript kamida 50 so\'zdan iborat bo\'lishi kerak' }, { status: 400 })
    }
    allowed.transcript = transcript
  }
  if ('duration_seconds' in body) allowed.duration_seconds = body.duration_seconds ?? null
  if ('order_index' in body) allowed.order_index = Number(body.order_index)
  if ('is_premium' in body) allowed.is_premium = Boolean(body.is_premium)
  if ('is_active' in body) allowed.is_active = Boolean(body.is_active)

  const { data, error } = await admin
    .from('scripts')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = createAdminClient()

  const { data: script } = await admin
    .from('scripts')
    .select('audio_url, thumbnail_url')
    .eq('id', id)
    .single()

  const { error } = await admin.from('scripts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (script?.audio_url) {
    const path = storagePathFromUrl(script.audio_url, 'script_audio')
    if (path) await admin.storage.from('script_audio').remove([path])
  }
  if (script?.thumbnail_url) {
    const path = storagePathFromUrl(script.thumbnail_url, 'script_thumbnails')
    if (path) await admin.storage.from('script_thumbnails').remove([path])
  }

  return new Response(null, { status: 204 })
}

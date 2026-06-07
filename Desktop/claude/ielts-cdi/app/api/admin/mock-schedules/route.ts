export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'maxmudovamashxura71@gmail.com'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

/** GET /api/admin/mock-schedules — list all schedules newest first */
export async function GET() {
  const user = await verifyAdmin()
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mock_schedules')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** POST /api/admin/mock-schedules — create or update a schedule (upsert by id) */
export async function POST(request: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    id,
    date,
    time,
    status,
    reading_file_url,
    listening_file_url,
    writing_task1_image_url,
    writing_task1_topic,
    writing_task2_topic,
  } = body

  if (!date || !time) {
    return Response.json({ error: 'date va time kerak' }, { status: 400 })
  }

  const admin = createAdminClient()

  const row = {
    ...(id ? { id } : {}),
    date,
    time,
    status: status ?? 'scheduled',
    reading_file_url:        reading_file_url        ?? null,
    listening_file_url:      listening_file_url      ?? null,
    writing_task1_image_url: writing_task1_image_url ?? null,
    writing_task1_topic:     writing_task1_topic     ?? null,
    writing_task2_topic:     writing_task2_topic     ?? null,
  }

  const { data, error } = await admin
    .from('mock_schedules')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

/** DELETE /api/admin/mock-schedules — delete a schedule and its files */
export async function DELETE(request: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json() as { id: string }
  if (!id) return Response.json({ error: 'id kerak' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch URLs so we can remove storage files
  const { data: schedule } = await admin
    .from('mock_schedules')
    .select('reading_file_url, listening_file_url, writing_task1_image_url')
    .eq('id', id)
    .single()

  if (schedule) {
    const toDelete: string[] = []
    for (const url of [
      schedule.reading_file_url,
      schedule.listening_file_url,
      schedule.writing_task1_image_url,
    ]) {
      if (!url) continue
      // Extract path after /object/public/tests/
      const marker = '/object/public/tests/'
      const idx = url.indexOf(marker)
      if (idx !== -1) toDelete.push(decodeURIComponent(url.slice(idx + marker.length)))
    }
    if (toDelete.length) {
      await admin.storage.from('tests').remove(toDelete)
    }
  }

  const { error } = await admin.from('mock_schedules').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { isAdmin } from '@/lib/admin-config'

/** DELETE /api/admin/mock-schedules/[id] — delete a schedule and its storage files */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return Response.json({ error: 'id kerak' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch file URLs so we can remove them from storage
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

export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMock1hReminderEmail } from '@/lib/email'

/** GET /api/cron/mock-notify
 *  Called every 15 minutes by Vercel Cron (see vercel.json).
 *  Sends 1-hour reminder emails to users whose mock test starts in 55–75 min.
 */
export async function GET(req: Request) {
  // Simple secret check to prevent unauthorized triggers
  const secret = new URL(req.url).searchParams.get('secret')
  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Window: 55 to 75 minutes from now (cron runs every 15 min → we catch it once)
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000)
  const windowEnd   = new Date(now.getTime() + 75 * 60 * 1000)

  // Schedules not yet notified (email_notified_1h = false or null)
  const { data: schedules } = await admin
    .from('mock_schedules')
    .select('*')
    .eq('email_notified_1h', false)

  if (!schedules?.length) return Response.json({ notified: 0 })

  let notified = 0

  for (const s of schedules) {
    const testDt = new Date(`${s.date}T${s.time}`)
    if (testDt < windowStart || testDt > windowEnd) continue

    // Confirmed bookings for this schedule
    const { data: bookings } = await admin
      .from('mock_bookings')
      .select('user_id')
      .eq('schedule_id', s.id)
      .eq('status', 'confirmed')

    if (!bookings?.length) {
      // Mark notified even if no bookings (avoid repeated DB scans)
      await admin.from('mock_schedules').update({ email_notified_1h: true }).eq('id', s.id)
      continue
    }

    const userIds = bookings.map(b => b.user_id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    for (const p of profiles ?? []) {
      if (!p.email) continue
      await sendMock1hReminderEmail(
        p.email,
        p.full_name ?? 'Foydalanuvchi',
        s.date,
        s.time.slice(0, 5),
        s.id,
      )
      notified++
    }

    await admin.from('mock_schedules').update({ email_notified_1h: true }).eq('id', s.id)
  }

  return Response.json({ notified, checkedAt: now.toISOString() })
}

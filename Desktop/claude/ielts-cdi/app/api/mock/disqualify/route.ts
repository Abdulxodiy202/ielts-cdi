export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * POST /api/mock/disqualify
 * Called when a user is disqualified for cheating (3 violations).
 * Body: { schedule_id }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let schedule_id: string | undefined
  try {
    const body = await request.json()
    schedule_id = body.schedule_id
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!schedule_id) {
    return Response.json({ error: 'schedule_id required' }, { status: 400 })
  }

  // Fetch profile for Telegram notification
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  const userName  = profile?.full_name ?? user.email ?? 'Foydalanuvchi'
  const userPhone = profile?.phone ?? '—'

  // Send Telegram notification
  try {
    await sendTelegramNotification([
      `🚫 <b>Chetlatish!</b>`,
      ``,
      `👤 <b>Talaba:</b> ${userName}`,
      `📧 <b>Email:</b> ${user.email}`,
      `📞 <b>Telefon:</b> ${userPhone}`,
      ``,
      `⚠️ 3 marta qoidabuzarlik (tab almashtirish / to'liq ekrandan chiqish)`,
      `❌ Test <b>bekor qilindi</b>`,
    ].join('\n'))
  } catch (err) {
    console.error('[mock/disqualify] telegram error:', err)
  }

  // Mark existing submission as 'disqualified' so admin can see it was cheating
  try {
    const admin = createAdminClient()
    await admin
      .from('mock_test_submissions')
      .update({ status: 'disqualified', submitted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('schedule_id', schedule_id)
  } catch (err) {
    console.error('[mock/disqualify] update submission error:', err)
  }

  return Response.json({ ok: true })
}

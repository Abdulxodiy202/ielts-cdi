export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * POST /api/mock/free-book
 *
 * Lightweight booking path for schedules the admin marked price=0
 * (migration 037). Skips the whole payment_requests/receipt-upload/
 * Telegram-approval flow that /api/payment uses — a free session is
 * confirmed immediately from just name + phone, no admin action
 * needed. The price check is re-verified server-side (never trust the
 * client's claim that a session is free) so this can't be used to
 * dodge payment on a paid session.
 *
 * Body: { scheduleId: string, fullName: string, phone: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    scheduleId?: unknown
    fullName?: unknown
    phone?: unknown
  }
  const scheduleId = typeof body.scheduleId === 'string' ? body.scheduleId : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (!scheduleId) return Response.json({ error: 'scheduleId required' }, { status: 400 })
  if (!fullName) return Response.json({ error: 'name_required' }, { status: 400 })
  if (!phone) return Response.json({ error: 'phone_required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: schedule, error: scheduleErr } = await admin
    .from('mock_schedules')
    .select('id, date, time, price, capacity')
    .eq('id', scheduleId)
    .maybeSingle()

  if (scheduleErr || !schedule) {
    return Response.json({ error: 'Schedule not found' }, { status: 404 })
  }
  // Authoritative check — a schedule with price > 0 must go through
  // the normal /api/payment receipt flow, regardless of what the
  // client sent.
  if ((schedule.price ?? 20000) !== 0) {
    return Response.json({ error: 'not_free' }, { status: 403 })
  }

  // Same confirmed-only capacity guard as /api/payment (migration
  // 030/032), so a free session respects its seat cap too.
  if (schedule.capacity !== null && Number.isInteger(schedule.capacity)) {
    const { count } = await admin
      .from('mock_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_id', scheduleId)
      .eq('status', 'confirmed')
    if ((count ?? 0) >= schedule.capacity) {
      return Response.json(
        { error: 'session_full', message: 'Uzr, bu seansda joylar to\'ldi. Boshqa seansni tanlang.' },
        { status: 409 },
      )
    }
  }

  // Idempotency: don't create a duplicate row if the user already has
  // an active booking for this schedule (e.g. a double-click or retry).
  const { data: existing } = await admin
    .from('mock_bookings')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('schedule_id', scheduleId)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'already_booked' }, { status: 409 })
  }

  const baseBookingRow = {
    user_id: user.id,
    schedule_id: scheduleId,
    booking_date: schedule.date,
    time_slot: schedule.time.slice(0, 5),
    payment_status: 'paid',
    payment_ref: null,
    status: 'confirmed',
  }

  // No payment_requests row exists for a free booking (that's the whole
  // point), so store what the student typed directly on the booking --
  // it's the only place the admin bookings/submissions lists can read
  // it from (migration 038). Retry without the two columns if that
  // migration hasn't been run yet, so booking still succeeds.
  let { error: insertErr } = await admin.from('mock_bookings').insert({
    ...baseBookingRow,
    user_name: fullName,
    user_phone: phone,
  })
  if (insertErr?.code === '42703') {
    ;({ error: insertErr } = await admin.from('mock_bookings').insert(baseBookingRow))
  }

  if (insertErr) {
    console.error('[mock/free-book] insert error:', insertErr)
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  const createdAt = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendTelegramNotification(
    `🆓 <b>Yangi BEPUL bron! (avtomatik tasdiqlangan)</b>\n\n` +
    `👤 Ism: ${fullName}\n` +
    `📧 Email: ${user.email}\n` +
    `📱 Telefon: ${phone}\n` +
    `📅 Sana: ${schedule.date} ${schedule.time.slice(0, 5)}\n` +
    `⏰ Vaqt: ${createdAt}\n\n` +
    `Admin panel: ${appUrl}/admin`,
  )

  return Response.json({ success: true })
}

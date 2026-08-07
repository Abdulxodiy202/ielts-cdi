export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { answerCallbackQuery, sendTelegramNotification } from '@/lib/telegram'
import { sendPremiumApprovalEmail, sendBookingApprovalEmail } from '@/lib/email'
import { handleReferralConversion } from '@/lib/referral'

/** Quick health check — also shows what Telegram last delivered */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return Response.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' })

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const info = await infoRes.json()
  return Response.json({ ok: true, webhook_info: info })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  const callbackQuery = body.callback_query as
    | { id: string; data: string; from: { first_name?: string; username?: string } }
    | undefined

  if (!callbackQuery) {
    // Not a callback query (could be a plain message) — just acknowledge
    return Response.json({ ok: true })
  }

  const { id: callbackQueryId, data, from } = callbackQuery
  const adminName = from?.first_name ?? from?.username ?? 'Admin'

  const admin = createAdminClient()

  /* ── Parse callback_data ─────────────────────────────────────────── */
  let action: 'approve_premium' | 'approve_mock' | 'reject' | null = null
  let paymentId: string | null = null

  if (data.startsWith('approve_premium_')) {
    action = 'approve_premium'
    paymentId = data.slice('approve_premium_'.length)
  } else if (data.startsWith('approve_mock_')) {
    action = 'approve_mock'
    paymentId = data.slice('approve_mock_'.length)
  } else if (data.startsWith('reject_')) {
    action = 'reject'
    paymentId = data.slice('reject_'.length)
  }

  if (!action || !paymentId) {
    await answerCallbackQuery(callbackQueryId, 'Noma\'lum buyruq')
    return Response.json({ ok: true })
  }

  /* ── Fetch payment request ───────────────────────────────────────── */
  const { data: payment, error: fetchError } = await admin
    .from('payment_requests')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (fetchError || !payment) {
    await answerCallbackQuery(callbackQueryId, 'To\'lov topilmadi')
    return Response.json({ ok: true })
  }

  if (payment.status !== 'pending') {
    await answerCallbackQuery(callbackQueryId, `Allaqachon: ${payment.status}`)
    return Response.json({ ok: true })
  }

  /* ── Apply action ────────────────────────────────────────────────── */
  if (action === 'reject') {
    // Answer immediately so Telegram doesn't show spinner timeout
    await answerCallbackQuery(callbackQueryId, '❌ Rad etildi')

    try {
      await admin
        .from('payment_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', paymentId)

      await sendTelegramNotification(
        `❌ <b>To'lov rad etildi</b>\n👤 ${payment.user_name}\n💳 ${payment.type}\n💵 ${payment.amount} UZS\n🔧 Admin: ${adminName}`
      )
    } catch (err) {
      console.error('[telegram-webhook] reject error:', err)
    }

    return Response.json({ ok: true })
  }

  // approve_premium
  if (action === 'approve_premium') {
    // Answer immediately so Telegram doesn't show spinner timeout
    await answerCallbackQuery(callbackQueryId, '✅ Premium berildi!')

    try {
      await admin
        .from('payment_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', paymentId)

      // Grant premium: 1 calendar month from now
      const premiumUntil = new Date()
      premiumUntil.setMonth(premiumUntil.getMonth() + 1)

      await admin
        .from('profiles')
        .update({ is_premium: true, premium_until: premiumUntil.toISOString() })
        .eq('id', payment.user_id)

      // Upsert subscription row (same expiry date)
      await admin.from('subscriptions').upsert({
        user_id: payment.user_id,
        plan: 'premium',
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: premiumUntil.toISOString(),
      }, { onConflict: 'user_id' })

      await Promise.all([
        sendTelegramNotification(
          `✅ <b>Premium faollashtirildi</b>\n👤 ${payment.user_name}\n📧 ${payment.user_email}\n💵 ${payment.amount} UZS\n🔧 Admin: ${adminName}`
        ),
        sendPremiumApprovalEmail(payment.user_email, payment.user_name),
        handleReferralConversion(paymentId).catch(e => console.error('[referral conversion]', e)),
      ])
    } catch (err) {
      console.error('[telegram-webhook] approve_premium error:', err)
    }

    return Response.json({ ok: true })
  }

  // approve_mock
  if (action === 'approve_mock') {
    // Answer Telegram FIRST — must respond within ~10 s or button stays spinning
    await answerCallbackQuery(callbackQueryId, '✅ Booking tasdiqlandi!')

    try {
      await admin
        .from('payment_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', paymentId)

      // Confirm the booking — prefer schedule_id match (migration 007),
      // fall back to booking_date + time_slot for older rows.
      // If the column doesn't exist yet (error 42703), retry without it.
      if (payment.meta?.schedule_id) {
        const { error: bySchedule } = await admin
          .from('mock_bookings')
          .update({ payment_status: 'paid', status: 'confirmed' })
          .eq('user_id', payment.user_id)
          .eq('schedule_id', payment.meta.schedule_id)

        // Column missing (migration 007 not run) — fall back to date+slot
        if (bySchedule?.code === '42703' && payment.meta?.booking_date && payment.meta?.time_slot) {
          await admin
            .from('mock_bookings')
            .update({ payment_status: 'paid', status: 'confirmed' })
            .eq('user_id', payment.user_id)
            .eq('booking_date', payment.meta.booking_date)
            .eq('time_slot', payment.meta.time_slot)
        }
      } else if (payment.meta?.booking_date && payment.meta?.time_slot) {
        await admin
          .from('mock_bookings')
          .update({ payment_status: 'paid', status: 'confirmed' })
          .eq('user_id', payment.user_id)
          .eq('booking_date', payment.meta.booking_date)
          .eq('time_slot', payment.meta.time_slot)
      }

      await Promise.all([
        sendTelegramNotification(
          `✅ <b>Mock Test tasdiqlandi</b>\n👤 ${payment.user_name}\n📅 ${payment.meta?.booking_date ?? ''} ${payment.meta?.time_slot ?? ''}\n💵 ${payment.amount} UZS\n🔧 Admin: ${adminName}`
        ),
        sendBookingApprovalEmail(
          payment.user_email,
          payment.user_name,
          payment.meta?.booking_date ?? '',
          payment.meta?.time_slot ?? ''
        ),
      ])
    } catch (err) {
      console.error('[telegram-webhook] approve_mock error:', err)
    }

    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}

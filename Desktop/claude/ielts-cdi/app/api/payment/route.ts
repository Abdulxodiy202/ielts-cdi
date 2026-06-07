export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelegramNotification, sendTelegramPhoto } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const receipt = formData.get('receipt') as File | null
  const userName = formData.get('user_name') as string
  const userPhone = formData.get('user_phone') as string
  const type = formData.get('type') as 'premium' | 'mock_booking'
  const amount = parseInt(formData.get('amount') as string)
  const metaRaw = formData.get('meta') as string | null
  const meta = metaRaw ? JSON.parse(metaRaw) : null

  if (!receipt || !userName || !userPhone || !type || !amount) {
    return Response.json({ error: 'Maydonlar to\'ldirilishi shart' }, { status: 400 })
  }

  // Upload receipt image to Supabase Storage
  const fileExt = (receipt.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `${user.id}-${Date.now()}.${fileExt}`
  const fileBytes = await receipt.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(fileName, fileBytes, { contentType: receipt.type, upsert: false })

  if (uploadError) {
    return Response.json(
      { error: `Rasm yuklanmadi: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('receipts').getPublicUrl(fileName)

  // Save payment request
  const { data: paymentRequest, error: insertError } = await supabase
    .from('payment_requests')
    .insert({
      user_id: user.id,
      user_name: userName,
      user_email: user.email,
      user_phone: userPhone,
      type,
      amount,
      receipt_url: publicUrl,
      status: 'pending',
      meta,
    })
    .select()
    .single()

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // For mock_booking: also create a pending booking record.
  // Try with schedule_id first (migration 007); if the column doesn't exist yet
  // (error code 42703), fall back to inserting without it so the flow still works.
  if (type === 'mock_booking' && meta?.booking_date && meta?.time_slot) {
    const baseRow = {
      user_id: user.id,
      booking_date: meta.booking_date,
      time_slot: meta.time_slot,
      payment_status: 'pending',
      payment_ref: `PR-${paymentRequest.id}`,
      status: 'pending',
    }

    if (meta.schedule_id) {
      const { error: insertErr } = await supabase
        .from('mock_bookings')
        .insert({ ...baseRow, schedule_id: meta.schedule_id })

      // Column doesn't exist yet — retry without it
      if (insertErr?.code === '42703') {
        await supabase.from('mock_bookings').insert(baseRow)
      }
    } else {
      await supabase.from('mock_bookings').insert(baseRow)
    }
  }

  // Telegram notification
  const typeLabel =
    type === 'premium' ? 'Premium Obuna' : "Mock Test Ro'yxatdan o'tish"
  const createdAt = new Date().toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const caption =
    `💰 <b>Yangi to'lov so'rovi!</b>\n\n` +
    `👤 Ism: ${userName}\n` +
    `📧 Email: ${user.email}\n` +
    `📱 Telefon: ${userPhone}\n` +
    `💳 Tur: ${typeLabel}\n` +
    `💵 Summa: ${amount} UZS\n` +
    `⏰ Vaqt: ${createdAt}\n\n` +
    `Admin panel: ${appUrl}/admin`

  // Build inline keyboard buttons
  const pid = paymentRequest.id
  const buttons =
    type === 'premium'
      ? [[
          { text: '✅ Premium Ber', callback_data: `approve_premium_${pid}` },
          { text: '❌ Rad Et',      callback_data: `reject_${pid}` },
        ]]
      : [[
          { text: '✅ Tasdiqlash',  callback_data: `approve_mock_${pid}` },
          { text: '❌ Rad Et',      callback_data: `reject_${pid}` },
        ]]

  // Send receipt photo with caption; fall back to text-only on failure
  try {
    await sendTelegramPhoto(publicUrl, caption, buttons)
  } catch {
    await sendTelegramNotification(caption, buttons)
  }

  return Response.json({ success: true, id: paymentRequest.id })
}

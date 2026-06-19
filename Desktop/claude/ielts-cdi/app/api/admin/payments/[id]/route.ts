export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleReferralConversion } from '@/lib/referral'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Verify admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action, admin_note } = await request.json()
  if (!['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the payment request
  const { data: pr, error: prError } = await admin
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (prError || !pr) {
    return Response.json({ error: "To'lov so'rovi topilmadi" }, { status: 404 })
  }

  // Update status
  const { error: updateError } = await admin
    .from('payment_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_note: admin_note || null,
    })
    .eq('id', id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  if (action === 'approve') {
    if (pr.type === 'premium') {
      // Grant 1 calendar month of premium
      const premiumUntil = new Date()
      premiumUntil.setMonth(premiumUntil.getMonth() + 1)

      // Update profile + insert subscription record in parallel (independent writes)
      await Promise.all([
        admin
          .from('profiles')
          .update({
            is_premium: true,
            premium_until: premiumUntil.toISOString(),
          })
          .eq('id', pr.user_id),
        handleReferralConversion(id).catch(e => console.error('[referral conversion]', e)),
        admin.from('subscriptions').insert({
          user_id: pr.user_id,
          plan: 'premium',
          price: pr.amount,
          currency: 'UZS',
          expires_at: premiumUntil.toISOString(),
          payment_ref: `PR-${pr.id}`,
          status: 'active',
        }),
      ])
    } else if (pr.type === 'mock_booking' && pr.meta) {
      // Match by schedule_id if present (new flow), otherwise fall back to date+slot
      if (pr.meta.schedule_id) {
        await admin
          .from('mock_bookings')
          .update({ status: 'confirmed', payment_status: 'paid' })
          .eq('user_id', pr.user_id)
          .eq('schedule_id', pr.meta.schedule_id)
      } else {
        await admin
          .from('mock_bookings')
          .update({ status: 'confirmed', payment_status: 'paid' })
          .eq('user_id', pr.user_id)
          .eq('booking_date', pr.meta.booking_date)
          .eq('time_slot', pr.meta.time_slot)
      }
    }
  }

  return Response.json({ success: true })
}

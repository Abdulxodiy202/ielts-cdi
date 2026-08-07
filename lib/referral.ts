import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * Called when a premium payment is approved.
 * If the payment has a referral_code, mark the referral as converted
 * and send a Telegram milestone notification if needed.
 */
export async function handleReferralConversion(paymentId: string) {
  const admin = createAdminClient()

  // Get the payment request to find referral_code and buyer info
  const { data: pr } = await admin
    .from('payment_requests')
    .select('referral_code, user_id, user_name, user_email')
    .eq('id', paymentId)
    .single()

  if (!pr?.referral_code) return

  // Find referrer by referral_code
  const { data: referrerProfile } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('referral_code', pr.referral_code)
    .single()

  if (!referrerProfile) return

  // Check if we already have a referral record for this referred user
  const { data: existingRef } = await admin
    .from('referrals')
    .select('id, converted_to_premium')
    .eq('referrer_id', referrerProfile.id)
    .eq('referred_id', pr.user_id)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existingRef) {
    // Update existing referral to converted
    if (!existingRef.converted_to_premium) {
      await admin
        .from('referrals')
        .update({ converted_to_premium: true, converted_at: now })
        .eq('id', existingRef.id)
    }
  } else {
    // Insert new referral record as converted
    await admin.from('referrals').insert({
      referrer_id: referrerProfile.id,
      referred_id: pr.user_id,
      referred_email: pr.user_email,
      referred_name: pr.user_name,
      converted_to_premium: true,
      converted_at: now,
    })
  }

  // Count total conversions for this referrer
  const { count } = await admin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerProfile.id)
    .eq('converted_to_premium', true)

  const total = count ?? 0

  // Send milestone notification at every 5 conversions
  if (total > 0 && total % 5 === 0) {
    const referrerName = referrerProfile.full_name ?? referrerProfile.email ?? 'Foydalanuvchi'
    const referrerEmail = referrerProfile.email ?? ''
    await sendTelegramNotification(
      `🎯 <b>Referral milestone!</b>\n\n👤 ${referrerName} (${referrerEmail}) orqali <b>${total} ta</b> odam premium oldi!\n\nUlar bilan bog'laning. 🎁`
    )
  }
}

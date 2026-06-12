import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch all bookings — include payment_ref so we can look up the phone
  const { data: bookings, error } = await admin
    .from('mock_bookings')
    .select('id, user_id, status, payment_status, payment_ref, created_at')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json([])
  }

  const userIds = [...new Set(bookings.map((b: any) => b.user_id as string))]

  // Extract payment_request IDs from payment_ref (format: "PR-<uuid>")
  const paymentReqIds: string[] = []
  const bookingToPaymentId: Record<string, string> = {}
  for (const b of bookings as any[]) {
    if (b.payment_ref && typeof b.payment_ref === 'string' && b.payment_ref.startsWith('PR-')) {
      const pid = b.payment_ref.slice(3)
      paymentReqIds.push(pid)
      bookingToPaymentId[b.id] = pid
    }
  }

  // Fetch profiles + payment_requests in parallel
  const [profilesRes, paymentRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, phone, is_premium')
      .in('id', userIds),
    paymentReqIds.length > 0
      ? admin
          .from('payment_requests')
          .select('id, user_id, user_phone')
          .in('id', paymentReqIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const profileMap: Record<string, any> = {}
  for (const p of profilesRes.data ?? []) {
    profileMap[p.id] = p
  }

  // Build phone lookup: user_id → phone from payment_requests
  // payment_requests is more reliable because phone is always entered on payment
  const paymentPhoneMap: Record<string, string> = {}
  for (const pr of paymentRes.data ?? []) {
    if (pr.user_phone) paymentPhoneMap[pr.user_id] = pr.user_phone
  }

  const enriched: any[] = bookings.map((b: any) => {
    const profile = profileMap[b.user_id] ?? {}
    // Phone priority: payment_requests → profiles.phone → ''
    const phone = paymentPhoneMap[b.user_id] || profile.phone || ''
    return {
      id: b.id,
      user_id: b.user_id,
      user_name: profile.full_name ?? 'Noma\'lum',
      user_email: profile.email ?? '',
      user_phone: phone,
      is_premium: profile.is_premium ?? false,
      status: b.status,
      payment_status: b.payment_status,
      created_at: b.created_at,
    }
  })

  // Sort: users with phone first (ascending), then empty phone last
  enriched.sort((a, b) => {
    const ap = a.user_phone
    const bp = b.user_phone
    if (!ap && !bp) return 0
    if (!ap) return 1
    if (!bp) return -1
    return ap.localeCompare(bp)
  })

  return NextResponse.json(enriched)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

import { isAdmin } from '@/lib/admin-config'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch all bookings — include payment_ref so we can look up the
  // phone, and user_name/user_phone (migration 038) which free bookings
  // (/api/mock/free-book) populate directly since they have no
  // payment_requests row to read from.
  let bookings: any[] | null = null
  let error: any = null
  {
    const res = await admin
      .from('mock_bookings')
      .select('id, user_id, status, payment_status, payment_ref, user_name, user_phone, created_at')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: true })
    bookings = res.data
    error = res.error
  }

  // Migration 038 not run yet — retry without the two new columns so
  // this endpoint still works instead of hard-failing.
  if (error?.code === '42703') {
    const res = await admin
      .from('mock_bookings')
      .select('id, user_id, status, payment_status, payment_ref, created_at')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: true })
    bookings = res.data
    error = res.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json([])
  }

  // Self-healing auto-resign (same rule /api/mock/schedules applies for
  // the student): a 'confirmed' booking whose session started more than
  // 5 minutes ago with no submission flips to 'resigned' right here too.
  // Without this, the admin only sees "Kelmadi" once the student
  // themselves happens to reload their own Mock Test page — this makes
  // opening the admin Bookinglar modal enough on its own.
  {
    const [scheduleRes, submissionsRes] = await Promise.all([
      admin.from('mock_schedules').select('date, time').eq('id', scheduleId).maybeSingle(),
      admin.from('mock_test_submissions').select('user_id').eq('schedule_id', scheduleId),
    ])
    if (scheduleRes.data) {
      const hhmm = String(scheduleRes.data.time).slice(0, 5)
      const startMs = new Date(`${scheduleRes.data.date}T${hhmm}:00+05:00`).getTime()
      if (Date.now() > startMs + 5 * 60 * 1000) {
        const submittedUserIds = new Set((submissionsRes.data ?? []).map((s: any) => s.user_id))
        const toResign = (bookings as any[])
          .filter(b => b.status === 'confirmed' && !submittedUserIds.has(b.user_id))
          .map(b => b.user_id)
        if (toResign.length > 0) {
          const { error: resignErr } = await admin
            .from('mock_bookings')
            .update({ status: 'resigned', resign_reason: 'Vaqtida kirmadi' })
            .eq('schedule_id', scheduleId)
            .eq('status', 'confirmed')
            .in('user_id', toResign)
          if (resignErr) {
            await admin
              .from('mock_bookings')
              .update({ status: 'resigned' })
              .eq('schedule_id', scheduleId)
              .eq('status', 'confirmed')
              .in('user_id', toResign)
          }
          // Reflect locally so this same response shows it immediately.
          for (const b of bookings as any[]) {
            if (b.status === 'confirmed' && toResign.includes(b.user_id)) b.status = 'resigned'
          }
        }
      }
    }
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
    // Phone priority: payment_requests (paid bookings) → booking's own
    // user_phone (free bookings -- migration 038, typed into
    // FreeBookingModal at booking time) → profiles.phone → ''
    const phone = paymentPhoneMap[b.user_id] || b.user_phone || profile.phone || ''
    // Name priority: booking's own user_name (free bookings) →
    // profiles.full_name (paid bookings, or if the free-booker's own
    // account name happens to be set) → 'Noma'lum' as last resort.
    const name = b.user_name || profile.full_name || 'Noma\'lum'
    return {
      id: b.id,
      user_id: b.user_id,
      user_name: name,
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

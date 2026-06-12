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

  // Fetch all bookings for this schedule (all statuses)
  const { data: bookings, error } = await admin
    .from('mock_bookings')
    .select('id, user_id, status, payment_status, created_at')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json([])
  }

  const userIds = [...new Set(bookings.map((b: any) => b.user_id as string))]

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, phone, is_premium')
    .in('id', userIds)

  const profileMap: Record<string, any> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p
  }

  const enriched = bookings.map((b: any) => {
    const profile = profileMap[b.user_id] ?? {}
    return {
      id: b.id,
      user_id: b.user_id,
      user_name: profile.full_name ?? 'Noma\'lum',
      user_email: profile.email ?? '',
      user_phone: profile.phone ?? '',
      is_premium: profile.is_premium ?? false,
      status: b.status,
      payment_status: b.payment_status,
      created_at: b.created_at,
    }
  })

  return NextResponse.json(enriched)
}

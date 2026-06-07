export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminClient } from './AdminClient'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/dashboard')

  const admin = createAdminClient()

  const [{ data: payments }, { data: tests }, { data: schedules }] = await Promise.all([
    admin
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false }),
    admin
      .from('tests')
      .select('id, type, title, order_number, file_url')
      .order('type')
      .order('order_number'),
    admin
      .from('mock_schedules')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false }),
  ])

  return (
    <AdminClient
      initialPayments={payments ?? []}
      tests={tests ?? []}
      initialSchedules={schedules ?? []}
    />
  )
}

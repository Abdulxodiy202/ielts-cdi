export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MockTestClient } from '@/components/MockTestClient'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function MockTestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader titleKey="mock.title" subtitleKey="mock.subtitle" />
      <MockTestClient userId={user.id} />
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MockTestClient } from '@/components/MockTestClient'

export default async function MockTestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Mock IELTS Test
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Kelgusi seans larni ko&apos;ring va bron qiling · 20,000 UZS
        </p>
      </div>
      <MockTestClient userId={user.id} />
    </div>
  )
}

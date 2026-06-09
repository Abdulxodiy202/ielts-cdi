export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch all auth users
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const authUsers = authData?.users ?? []

  // Fetch all profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, is_premium, premium_until')

  const profileMap: Record<string, { full_name: string | null; is_premium: boolean; premium_until: string | null }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = {
      full_name: p.full_name ?? null,
      is_premium: p.is_premium ?? false,
      premium_until: p.premium_until ?? null,
    }
  }

  const result = authUsers.map(u => {
    // Best available display name: profile → user_metadata.full_name → user_metadata.name → null
    const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
    const profileName = profileMap[u.id]?.full_name
    const full_name = profileName || meta.full_name || meta.name || null

    // Auth provider from app_metadata
    const provider = ((u.app_metadata ?? {}) as Record<string, string | undefined>).provider ?? 'email'

    return {
      id: u.id,
      email: u.email ?? '',
      full_name,
      provider,
      is_premium: profileMap[u.id]?.is_premium ?? false,
      premium_until: profileMap[u.id]?.premium_until ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }
  })

  // Sort by created_at ascending
  result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return NextResponse.json(result)
}

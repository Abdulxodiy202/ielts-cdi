export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const hasUrl  = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasKey  = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasSvc  = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  let user = null
  let authError = null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    user = data.user
      ? { id: data.user.id, email: data.user.email }
      : null
    authError = error?.message ?? null
  } catch (e) {
    authError = String(e)
  }

  return Response.json({
    env: {
      NEXT_PUBLIC_SUPABASE_URL:  hasUrl  ? '✅ set' : '❌ MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasKey ? '✅ set' : '❌ MISSING',
      SUPABASE_SERVICE_ROLE_KEY: hasSvc  ? '✅ set' : '❌ MISSING',
    },
    user,
    authError,
    isAdmin: user?.email === 'maxmudovamashxura71@gmail.com',
  })
}

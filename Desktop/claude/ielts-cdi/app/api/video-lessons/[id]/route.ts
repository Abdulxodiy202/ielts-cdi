export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [videoRes, profileRes] = await Promise.all([
    admin
      .from('video_lessons')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
  ])

  if (videoRes.error) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    video: videoRes.data,
    userPremium: isActivePremium(profileRes.data),
  })
}

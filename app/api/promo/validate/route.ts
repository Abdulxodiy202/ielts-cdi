export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await request.json()
  if (!code?.trim()) return Response.json({ error: 'Kod kiritilmadi' }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('promo_codes')
    .select('id, code, discount_percent, valid_from, valid_until, is_active, usage_type, assigned_user_id, used_by')
    .ilike('code', code.trim())
    .single()

  if (error || !data) {
    return Response.json({ valid: false, error: 'Promokod topilmadi' }, { status: 200 })
  }

  if (!data.is_active) {
    return Response.json({ valid: false, error: "Promokod o'chirilgan" }, { status: 200 })
  }

  if (now < data.valid_from || now > data.valid_until) {
    return Response.json({ valid: false, error: "Promokod muddati o'tgan" }, { status: 200 })
  }

  if (data.usage_type === 'one_time') {
    if (data.used_by) {
      return Response.json({ valid: false, error: 'Bu kod allaqachon ishlatilgan' }, { status: 200 })
    }
    if (data.assigned_user_id && data.assigned_user_id !== user.id) {
      return Response.json({ valid: false, error: 'Bu kod siz uchun emas' }, { status: 200 })
    }
  }

  return Response.json({ valid: true, discount_percent: data.discount_percent })
}

export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  // Fetch codes + usage count in one go
  const { data, error } = await admin
    .from('promo_codes')
    .select('*, usage:promo_code_usage(id, user_name, user_email, original_amount, discounted_amount, used_at)')
    .order('created_at', { ascending: false })

  if (error) {
    // 42P01 = undefined_table; surface as TABLE_NOT_FOUND so admin UI can show setup banner
    const code = (error as any).code
    if (code === '42P01' || error.message?.includes('does not exist')) {
      return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!await guardAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { code, discount_percent, valid_from, valid_until } = body

  if (!code?.trim()) return Response.json({ error: 'Kod kiritilishi shart' }, { status: 400 })
  if (!discount_percent || discount_percent < 1 || discount_percent > 100)
    return Response.json({ error: "Chegirma 1-100 oralig'ida bo'lishi kerak" }, { status: 400 })
  if (!valid_from || !valid_until)
    return Response.json({ error: 'Sanalar kiritilishi shart' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promo_codes')
    .insert({ code: code.trim().toUpperCase(), discount_percent, valid_from, valid_until })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Bu kod allaqachon mavjud' : error.message
    return Response.json({ error: msg }, { status: 400 })
  }
  return Response.json(data, { status: 201 })
}

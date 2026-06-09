export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  // Look up the target user's email
  const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(id)
  if (userErr || !targetUser?.user) {
    return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 })
  }

  const email = targetUser.user.email
  if (!email) {
    return NextResponse.json({ error: 'Email mavjud emas' }, { status: 400 })
  }

  // Generate a password-recovery link (valid for 1 hour by default)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkErr?.message ?? 'Havola yaratilmadi' },
      { status: 500 }
    )
  }

  return NextResponse.json({ link: linkData.properties.action_link, email })
}

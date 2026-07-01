import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, created_at')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.title          !== undefined) updates.title          = String(body.title).trim()
  if (body.order_index    !== undefined) updates.order_index    = Number(body.order_index)
  if (body.is_premium     !== undefined) updates.is_premium     = Boolean(body.is_premium)
  if (body.is_published   !== undefined) updates.is_published   = Boolean(body.is_published)
  if (body.file_url       !== undefined) updates.file_url       = body.file_url
  if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No fields' }, { status: 400 })
  console.log('[articles PATCH]', id, updates)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select('id, title, file_url, cover_image_url, is_premium, is_published, order_index, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('articles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

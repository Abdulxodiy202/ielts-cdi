import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  let query = supabase
    .from('tests')
    .select('*')
    .eq('is_published', true)
    .order('order_number')

  if (type) query = query.eq('type', type)

  const { data } = await query
  return NextResponse.json(data ?? [])
}

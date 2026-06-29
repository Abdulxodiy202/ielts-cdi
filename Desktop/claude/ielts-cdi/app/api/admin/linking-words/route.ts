export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!(user?.email && ADMIN_EMAILS.includes(user.email))
}

export async function GET() {
  if (!await isAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('linking_words')
    .select('*')
    .order('category')
    .order('word')
  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  if (!await isAdmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { word, uzbek_translation, english_definition, example_sentence, category, level, is_active } = body
  if (!word?.trim() || !uzbek_translation?.trim() || !english_definition?.trim() || !example_sentence?.trim() || !category || !level) {
    return Response.json({ error: 'Barcha majburiy maydonlarni to\'ldiring' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('linking_words')
    .insert({ word: word.trim(), uzbek_translation: uzbek_translation.trim(), english_definition: english_definition.trim(), example_sentence: example_sentence.trim(), category, level, is_active: is_active ?? true })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

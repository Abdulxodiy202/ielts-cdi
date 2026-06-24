import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const collectionId = req.nextUrl.searchParams.get('collection_id')

  const admin = createAdminClient()
  let query = admin
    .from('vocab_words')
    .select('id, collection_id, word, uzbek_translation, definition, example, extra, source, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (collectionId) query = query.eq('collection_id', collectionId)

  const { data, error } = await query
  if (error?.code === '42P01') return Response.json({ error: 'TABLE_NOT_FOUND' }, { status: 503 })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { collection_id, word, uzbek_translation, definition, example, extra, source } = body

  if (!collection_id || !word?.trim()) {
    return Response.json({ error: 'collection_id and word required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check ownership of collection
  const { data: col } = await admin
    .from('vocab_collections')
    .select('id')
    .eq('id', collection_id)
    .eq('user_id', user.id)
    .single()

  if (!col) return Response.json({ error: 'Collection not found' }, { status: 404 })

  const { data, error } = await admin
    .from('vocab_words')
    .insert({
      user_id: user.id,
      collection_id,
      word: word.trim(),
      uzbek_translation: uzbek_translation ?? null,
      definition: definition ?? null,
      example: example ?? null,
      extra: extra ?? null,
      source: source ?? 'manual',
    })
    .select('id, collection_id, word, uzbek_translation, definition, example, extra, source, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

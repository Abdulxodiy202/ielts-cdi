export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  /* Fetch all words via paginated loop (Supabase default limit = 1000) */
  type WordRow = { id: string; word: string; uzbek_translation: string; english_definition: string; example_sentence: string; category: string; level: string }
  const PAGE = 1000
  let allWords: WordRow[] = []
  let from = 0
  let fetchError: string | null = null

  while (true) {
    const { data, error } = await admin
      .from('reading_vocabulary')
      .select('id, word, uzbek_translation, english_definition, example_sentence, category, level')
      .eq('is_active', true)
      .order('level')
      .order('word')
      .range(from, from + PAGE - 1)

    if (error) { fetchError = error.message; break }
    if (!data || data.length === 0) break
    allWords = [...allWords, ...data]
    if (data.length < PAGE) break
    from += PAGE
  }

  if (fetchError) console.error('[reading vocab] words error:', fetchError)

  const savedRes = await admin
    .from('user_saved_reading_words')
    .select('word_id')
    .eq('user_id', user.id)

  if (savedRes.error) console.error('[reading vocab] saved error:', savedRes.error.message)

  const savedIds = (savedRes.data ?? []).map((r: { word_id: string }) => r.word_id)

  return Response.json({ words: allWords, savedIds })
}

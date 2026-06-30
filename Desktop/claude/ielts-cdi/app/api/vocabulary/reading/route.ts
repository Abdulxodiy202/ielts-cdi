export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [wordsRes, savedRes] = await Promise.all([
    admin
      .from('reading_vocabulary')
      .select('id, word, uzbek_translation, english_definition, example_sentence, category, level')
      .eq('is_active', true)
      .order('level')
      .order('word'),
    admin
      .from('user_saved_reading_words')
      .select('word_id')
      .eq('user_id', user.id),
  ])

  if (wordsRes.error) console.error('[reading vocab] words error:', wordsRes.error.message)
  if (savedRes.error) console.error('[reading vocab] saved error:', savedRes.error.message)

  const savedIds = (savedRes.data ?? []).map((r: { word_id: string }) => r.word_id)

  return Response.json({ words: wordsRes.data ?? [], savedIds })
}

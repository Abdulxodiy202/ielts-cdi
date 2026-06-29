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
      .from('linking_words')
      .select('id, word, uzbek_translation, english_definition, example_sentence, category, level')
      .eq('is_active', true)
      .order('category')
      .order('word'),
    admin
      .from('user_saved_linking_words')
      .select('word_id')
      .eq('user_id', user.id),
  ])

  const savedSet = new Set((savedRes.data ?? []).map((r: { word_id: string }) => r.word_id))
  const words = (wordsRes.data ?? []).map((w: Record<string, unknown>) => ({ ...w, is_saved: savedSet.has(w.id as string) }))

  return Response.json(words)
}

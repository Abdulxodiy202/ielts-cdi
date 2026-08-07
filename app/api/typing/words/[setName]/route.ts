export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IRREGULAR_VERBS } from '@/lib/data/irregular-verbs'

const WORD_COUNT = 300

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const isSingleWord = (w: string) => w.trim().length > 0 && !/\s/.test(w.trim())

async function getCommonEnglishWords(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data, error } = await admin
    .from('typing_word_sets')
    .select('word')
    .eq('set_name', 'common_english')

  if (error || !data || data.length === 0) return []
  return shuffle(data.map(r => r.word)).slice(0, WORD_COUNT)
}

/**
 * The schema doesn't match a single SQL UNION the way the spec assumed:
 * irregular_verbs isn't a DB table (it's a static list in lib/data), and
 * writing_collocations.word holds full phrases ("The graph illustrates"),
 * not single words. Combine all four sources in application code instead:
 * take single-word entries as-is from reading_vocabulary/linking_words,
 * split writing_collocations phrases into their constituent words (keeping
 * only words of length >= 4 so the set isn't dominated by "the"/"a"/"of",
 * which are already covered by Common English), and pull irregular verbs'
 * base forms directly from the static list.
 */
async function getIeltsVocabularyWords(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const [readingRes, linkingRes, collocRes] = await Promise.all([
    admin.from('reading_vocabulary').select('word').eq('is_active', true),
    admin.from('linking_words').select('word'),
    admin.from('writing_collocations').select('word'),
  ])

  if (readingRes.error && linkingRes.error && collocRes.error) return []

  const pool = new Set<string>()

  for (const row of readingRes.data ?? []) {
    const w = row.word?.trim().toLowerCase()
    if (w && isSingleWord(w)) pool.add(w)
  }
  for (const row of linkingRes.data ?? []) {
    const w = row.word?.trim().toLowerCase()
    if (w && isSingleWord(w)) pool.add(w)
  }
  for (const row of collocRes.data ?? []) {
    const phrase = row.word ?? ''
    for (const raw of phrase.split(/\s+/)) {
      const w = raw.replace(/[^a-zA-Z]/g, '').toLowerCase()
      if (w.length >= 4) pool.add(w)
    }
  }
  for (const verb of IRREGULAR_VERBS) {
    if (verb.base) pool.add(verb.base.toLowerCase())
  }

  return shuffle(Array.from(pool)).slice(0, WORD_COUNT)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ setName: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { setName } = await params
  const admin = createAdminClient()

  let words: string[] = []

  if (setName === 'ielts_vocabulary') {
    words = await getIeltsVocabularyWords(admin)
    // Fail silently to Common English if the combined query comes up empty.
    if (words.length === 0) words = await getCommonEnglishWords(admin)
  } else {
    words = await getCommonEnglishWords(admin)
  }

  return Response.json({ words })
}

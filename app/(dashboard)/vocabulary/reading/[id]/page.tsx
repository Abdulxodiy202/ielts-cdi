import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ReadingVocabTestView } from './ReadingVocabTestView'

export const revalidate = 300

export default async function ReadingVocabTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: test } = await createAdminClient()
    .from('tests')
    .select('id, title, test_number')
    .eq('id', id)
    .eq('type', 'reading')
    .single()

  if (!test) notFound()

  return (
    <ReadingVocabTestView
      testNumber={test.test_number}
      testTitle={test.title ?? null}
    />
  )
}

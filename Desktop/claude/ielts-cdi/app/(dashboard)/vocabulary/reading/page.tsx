import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReadingVocabClient from './ReadingVocabClient'

export const revalidate = 300

export default async function ReadingVocabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tests } = await supabase
    .from('tests')
    .select('id, title, test_number')
    .eq('type', 'reading')
    .order('test_number', { ascending: true })

  return <ReadingVocabClient tests={tests ?? []} />
}

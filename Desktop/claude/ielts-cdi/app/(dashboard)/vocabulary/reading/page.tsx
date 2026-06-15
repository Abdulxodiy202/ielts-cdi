import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">Vocabulary</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Reading Vocabulary</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>📑 Reading Vocabulary</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Academic vocabulary extracted from IELTS Reading tests
        </p>
      </div>

      {!tests || tests.length === 0 ? (
        <div className="py-16 text-center rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p>No reading tests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tests.map(test => (
            <div
              key={test.id}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  Test {test.test_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Tez kunda
                </span>
              </div>
              <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {test.title || `Reading Test ${test.test_number}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-muted)' }}>
        Vocabulary word lists per test coming soon. Words will be auto-extracted from test passages.
      </p>
    </div>
  )
}

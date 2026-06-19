import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

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
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">Vocabulary</Link>
          <span>/</span>
          <Link href="/vocabulary/reading" className="hover:underline">Reading Vocabulary</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Test {test.test_number}</span>
        </div>
        <Link
          href="/vocabulary/reading"
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> Reading Vocabulary ga qaytish
        </Link>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Reading Test {test.test_number} — Vocabulary
        </h1>
        {test.title && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{test.title}</p>
        )}
      </div>

      <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-5xl mb-4">📑</div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Tez kunda</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          So&apos;z ro&apos;yxati qo&apos;shiladi
        </p>
      </div>
    </div>
  )
}

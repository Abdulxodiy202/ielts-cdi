import Link from 'next/link'

export default function LinkingWordsPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">Vocabulary</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Linking Words</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>🔗 Linking Words</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Discourse markers and linking expressions to boost your coherence score
        </p>
      </div>
      <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Tez kunda...</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Categorised linking words for addition, contrast, cause, effect and more — coming soon.
        </p>
      </div>
    </div>
  )
}

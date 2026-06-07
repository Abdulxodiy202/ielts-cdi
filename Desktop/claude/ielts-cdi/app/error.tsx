'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Something went wrong</h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>{error.message}</p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  )
}

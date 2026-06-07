import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-7xl font-black" style={{ color: 'var(--accent)' }}>404</div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Page not found</h1>
      <Link href="/" className="btn-primary text-sm">Go Home</Link>
    </div>
  )
}

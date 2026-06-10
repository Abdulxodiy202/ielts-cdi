export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-pulse">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="h-8 w-52 rounded-lg mb-2" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-72 rounded" style={{ background: 'var(--bg-secondary)' }} />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card p-5">
            <div className="w-10 h-10 rounded-xl mb-3" style={{ background: 'var(--bg-primary)' }} />
            <div className="h-9 w-14 rounded mb-1" style={{ background: 'var(--bg-primary)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--bg-primary)' }} />
          </div>
        ))}
      </div>

      {/* Quick-action cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {[0, 1].map(i => (
          <div key={i} className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl shrink-0" style={{ background: 'var(--bg-primary)' }} />
            <div className="flex-1">
              <div className="h-4 w-32 rounded mb-2" style={{ background: 'var(--bg-primary)' }} />
              <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-primary)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recent tests heading + rows */}
      <div className="h-5 w-32 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
      <div className="card overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="px-5 py-4 flex items-center gap-4 border-b last:border-0"
            style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--bg-primary)' }} />
            <div className="flex-1">
              <div className="h-3.5 w-40 rounded mb-1.5" style={{ background: 'var(--bg-primary)' }} />
              <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-primary)' }} />
            </div>
            <div className="h-6 w-12 rounded-full" style={{ background: 'var(--bg-primary)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

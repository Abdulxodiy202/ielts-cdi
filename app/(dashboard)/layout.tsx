import { Sidebar } from '@/components/layout/Sidebar'
import { PresenceTracker } from '@/components/PresenceTracker'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-with-sidebar">
      {/* Har 30s profiles.last_seen_at'ni update qiladi -- admin
          panel online/offline indikatori shu ustunga tayanadi. */}
      <PresenceTracker />
      <Sidebar />
      <main className="main-content min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </main>
    </div>
  )
}

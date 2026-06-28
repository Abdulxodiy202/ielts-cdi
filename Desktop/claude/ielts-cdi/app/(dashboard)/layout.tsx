import { Sidebar } from '@/components/layout/Sidebar'
import { MusicPlayer } from '@/components/MusicPlayer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </main>
      <MusicPlayer />
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'

// Shared placeholder used by routes whose real content is still being
// built (Writing, Speaking, Community). Layout: large muted icon,
// section title, "Coming soon..." subtitle -- centered vertically in
// the content area. Uses theme CSS variables so it looks right under
// dark/light/cyber themes; does not use hardcoded white so it stays
// readable when the user has picked a light background.
interface ComingSoonProps {
  icon: LucideIcon
  title: string
  subtitle?: string
}

export function ComingSoon({ icon: Icon, title, subtitle = 'Coming soon...' }: ComingSoonProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <Icon size={80} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
      <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </h1>
      <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
        {subtitle}
      </p>
    </div>
  )
}

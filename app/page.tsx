export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HeroClient } from '@/components/landing/HeroClient'
import {
  LandingNavLinks,
  LandingAuthCta,
  LandingFeaturesSection,
  LandingBandTableSection,
  LandingPricingSection,
  LandingFooter,
} from '@/components/landing/LandingContent'
import Silk from '@/components/backgrounds/Silk'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctaHref = user ? '/dashboard' : '/login'

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ color: 'var(--text-primary)', background: '#0a0621' }}>
      {/* Silk WebGL fon -- fixed inset-0, z-index 0. Wrapper bg juda
          to'q (#0a0621) Silk bilan yumshoq aralashadi, WebGL yuklashda
          xato bo'lsa ham qora emas indigo tush. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <Silk speed={5} scale={1} color="#2d1b69" noiseIntensity={2.5} rotation={1.5} />
      </div>

      {/* Barcha content Silk ustida -- relative + z-10 stacking context */}
      <div className="relative" style={{ zIndex: 10 }}>

      {/* Navbar -- glass effekt, o'rtada nav link'lar */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-5"
        style={{
          background: 'rgba(2,6,23,0.60)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <svg width="34" height="38" viewBox="0 0 36 40" fill="none">
            <path d="M18 0L0 7V20C0 30 8 38 18 40C28 38 36 30 36 20V7L18 0Z" fill="#1e40af"/>
            <path d="M18 4L4 10V20C4 28 10 35 18 37C26 35 32 28 32 20V10L18 4Z" fill="#2563eb"/>
            <path d="M13 20L16.5 23.5L23 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>IELTS</span>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 12 }}>.PRO</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 7, letterSpacing: 2, fontWeight: 600 }}>BAND 9 STARTS HERE.</div>
          </div>
        </Link>

        {/* O'rtadagi nav link'lar -- smooth scroll anchor'lar. Mobile'da yashirin. */}
        <div className="hidden lg:flex items-center gap-2">
          <LandingNavLinks />
        </div>

        <div className="flex items-center gap-3">
          <LandingAuthCta hasUser={!!user} />
        </div>
      </nav>

      {/* Hero -- floating cards + shimmer + scroll indicator */}
      <HeroClient ctaHref={ctaHref} hasUser={!!user} />

      {/* Sections translated via LanguageContext (client components) */}
      <LandingFeaturesSection />
      <LandingBandTableSection />
      <LandingPricingSection ctaHref={ctaHref} />
      <LandingFooter ctaHref={ctaHref} />
      </div>{/* /content wrapper (z-10) */}
    </div>
  )
}

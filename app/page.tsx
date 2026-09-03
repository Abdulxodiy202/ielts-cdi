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
import { LandingSilk } from '@/components/landing/LandingSilk'
import { LandingShowcase } from '@/components/landing/LandingShowcase'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctaHref = user ? '/dashboard' : '/login'

  // "Mahsulot isboti" galereyasi -- admin panelning "Sayt rasmlari"
  // bo'limidan boshqariladi. RLS "is_published=true" bo'lganlarnigina
  // ochadi, shuning uchun bu yerda qo'shimcha filtr shart emas, lekin
  // tartib (order_index) uchun .order() kerak. Jadval hali migratsiya
  // qilinmagan bo'lsa (yangi loyihalarda), xatoni jim yutamiz --
  // galereya shunchaki ko'rsatilmaydi.
  const { data: showcaseImages } = await supabase
    .from('landing_showcase_images')
    .select('id, title, image_url')
    .order('order_index', { ascending: true })

  return (
    // `overflow-x-hidden` emas, `overflow-x-clip` ishlatilyabdi -- 'hidden'
    // bu elementni brauzerda "scroll konteyner"ga aylantirib qo'yardi,
    // shu sabab pastroqdagi `sticky top-0` navbar haqiqiy oyna scrolliga
    // emas, shu konteynerga bog'lanib qolib, scroll qilinganda butunlay
    // yo'qolib qolardi (Games sahifasidagi xuddi shu xil bug). 'clip'
    // xuddi shunday gorizontal tashqariga chiqishni kesadi, lekin scroll
    // konteyner yaratmaydi -- navbar endi doim ko'rinadi. 2026-08-28.
    <div className="min-h-screen relative overflow-x-clip" style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
      {/* Silk WebGL fon -- fixed inset-0, z-index 0.

          2026-08-27 tuzatish: kirish sahifasi endi profildan tanlangan
          temaga (dark/light) qarab rangini o'zgartiradi -- avval doim
          to'q edi. Silk'ning o'zi <LandingSilk /> ichida useTheme()
          orqali rang tanlaydi; matn/fon uchun var(--text-*), var(--bg-*)
          o'zgaruvchilari ham endi qat'iy dark'ga bog'lanmagan --
          profil oq bo'lsa sahifa oq, ko'k/dark bo'lsa ko'k bo'ladi. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <LandingSilk />
      </div>

      {/* Barcha content Silk ustida -- relative + z-10 stacking context */}
      <div className="relative" style={{ zIndex: 10 }}>

      {/* Navbar -- glass effekt, o'rtada nav link'lar. Fon endi
          var(--bg-primary) asosida (color-mix) -- dark temada to'q,
          light temada oq shisha effekti beradi. */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-5"
        style={{
          background: 'color-mix(in srgb, var(--bg-primary) 65%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
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

      {/* Mahsulot isboti -- haqiqiy sayt skrinshotlari, admin
          boshqaradi. Rasm bo'lmasa hech narsa render qilinmaydi. */}
      <LandingShowcase images={showcaseImages ?? []} />

      {/* Sections translated via LanguageContext (client components) */}
      <LandingFeaturesSection />
      <LandingBandTableSection />
      <LandingPricingSection ctaHref={ctaHref} />
      <LandingFooter ctaHref={ctaHref} />
      </div>{/* /content wrapper (z-10) */}
    </div>
  )
}

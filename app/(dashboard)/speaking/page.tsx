'use client'

import { Sparkles, Repeat2, PhoneCall, Lock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Speaking bo'limi endi 3ta qismdan iborat -- hammasi hali qurilyabdi,
// shuning uchun uchchalasi ham "Tez orada" (coming soon) karta sifatida
// ko'rinadi (Writing'dagi AI Writing kartasi bilan bir xil uslub):
//  1. AI Speaking     -- javobni yozib olib AI orqali band bali/feedback.
//  2. Shadowing       -- ona tilida so'zlashuvchi audio ortidan takrorlash.
//  3. SpeakLive       -- darajaga mos real userlar bilan 5 daqiqalik
//     jonli qo'ng'iroq (like, minut va call tarixi saqlanadi).
// 2026-08-28 qo'shildi.
const CARDS = [
  { icon: Sparkles,   titleKey: 'speaking.aiTitle',        descKey: 'speaking.aiDesc' },
  { icon: Repeat2,    titleKey: 'speaking.shadowingTitle',  descKey: 'speaking.shadowingDesc' },
  { icon: PhoneCall,  titleKey: 'speaking.speakliveTitle',  descKey: 'speaking.speakliveDesc' },
] as const

export default function SpeakingPage() {
  const { t } = useLanguage()

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          🎤 {t('speaking.title')}
        </h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          {t('speaking.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="block rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--skill-speaking) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--skill-speaking) 25%, transparent)',
              opacity: 0.85,
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, background: 'color-mix(in srgb, var(--skill-speaking) 15%, transparent)' }}
              >
                <Icon size={22} style={{ color: 'var(--skill-speaking)' }} />
              </div>
              <span
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <Lock size={10} /> {t('speaking.comingSoon')}
              </span>
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {t(titleKey)}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t(descKey)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

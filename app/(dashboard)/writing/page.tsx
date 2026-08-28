'use client'

import Link from 'next/link'
import { Sparkles, Keyboard, Lock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Writing bo'limi endi ikkita qismdan iborat: AI Writing (hali qurilyabdi
// -- shuning uchun bosib bo'lmaydigan "Tez orada" karta) va Typing
// amaliyoti (avval alohida /typing bo'lgan, endi shu yerga ko'chirildi).
// 2026-08-28 qo'shildi.
export default function WritingPage() {
  const { t } = useLanguage()

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          ✍️ {t('writing.title')}
        </h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          {t('writing.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* AI Writing -- hali tayyor emas, shuning uchun link emas oddiy
            karta, "Tez orada" nishoni bilan. */}
        <div
          className="block rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--skill-writing) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--skill-writing) 25%, transparent)', opacity: 0.85 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, background: 'color-mix(in srgb, var(--skill-writing) 15%, transparent)' }}
            >
              <Sparkles size={22} style={{ color: 'var(--skill-writing)' }} />
            </div>
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <Lock size={10} /> {t('writing.comingSoon')}
            </span>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('writing.aiTitle')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('writing.aiDesc')}
          </p>
        </div>

        {/* Typing amaliyoti -- ishlaydigan, bosiladigan karta. Avval
            var(--accent) (ko'k) ishlatilgan edi, shu bois yonidagi
            yashil AI Writing kartasidan rangi mos kelmasdi -- endi
            ikkalasi ham Writing bo'limining o'z rangi (--skill-writing,
            yashil)dan foydalanadi. 2026-08-28 tuzatish. */}
        <Link
          href="/writing/typing"
          className="group block rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          style={{ background: 'color-mix(in srgb, var(--skill-writing) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--skill-writing) 25%, transparent)' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, background: 'color-mix(in srgb, var(--skill-writing) 15%, transparent)' }}
            >
              <Keyboard size={22} style={{ color: 'var(--skill-writing)' }} />
            </div>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('writing.typingTitle')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('writing.typingDesc')}
          </p>
          <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--skill-writing)' }}>
            {t('vocabulary.open')} <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>
      </div>
    </div>
  )
}

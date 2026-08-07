'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, X } from 'lucide-react'
import { fireCelebrationConfetti } from '@/lib/confetti'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Reads the `?justEarned=N` query param dropped by the test-taking
// clients when the user leaves after a submit. Shows a floating toast
// on the list page; fires confetti on a perfect 5-star run. The param
// is stripped on mount so a refresh doesn't re-trigger the toast.

const AUTO_DISMISS_MS = 6000

export function CelebrationToast() {
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [stars, setStars] = useState<number | null>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  // Guard so a rerender of the same 5-star state doesn't re-fire.
  const firedRef = useRef(false)

  // Pluck the param exactly once. We consume it right away and clean the
  // URL so a subsequent reload doesn't fire the celebration again.
  useEffect(() => {
    const justEarned = searchParams.get('justEarned')
    if (justEarned === null) return
    const n = parseInt(justEarned, 10)
    if (Number.isFinite(n) && n >= 0 && n <= 5) setStars(n)
    // Strip via history API rather than router.replace() -- router.replace
    // would re-run the page's server data, which would refetch summaries
    // for nothing since state is already loaded.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('justEarned')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  useEffect(() => {
    if (stars === 5 && !firedRef.current) {
      firedRef.current = true
      // Wait one frame so the toast is actually laid out before we
      // read its bounding rect. Without this, on the initial render
      // the ref can be attached but rect.width can still be 0.
      requestAnimationFrame(() => {
        fireCelebrationConfetti(toastRef.current)
      })
    }
  }, [stars])

  useEffect(() => {
    if (stars !== null && stars > 0) {
      const timer = setTimeout(() => setStars(null), AUTO_DISMISS_MS)
      return () => clearTimeout(timer)
    }
  }, [stars])

  // 0-star or already-dismissed: render nothing.
  if (stars === null || stars <= 0) return null

  return (
    <div
      role="status"
      ref={toastRef}
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        // Above canvas-confetti's default 999 so stray particles never
        // obscure the toast text.
        zIndex: 1000,
        padding: '20px 32px',
        background:
          'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(99, 102, 241, 0.15))',
        border: '1px solid rgba(251, 191, 36, 0.4)',
        borderRadius: 20,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 10px 40px rgba(251, 191, 36, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        maxWidth: '90vw',
        animation: 'celebration-in 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes celebration-in {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const filled = n <= stars
          return (
            <Star
              key={n}
              size={44}
              strokeWidth={filled ? 0 : 2}
              fill={filled ? '#fbbf24' : 'none'}
              color={filled ? '#fbbf24' : 'rgba(255, 255, 255, 0.15)'}
              style={filled ? { filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.5))' } : undefined}
            />
          )
        })}
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: 'white', textAlign: 'center' }}>
        {t(`celebration.msg${stars}`)}
      </div>

      <button
        type="button"
        aria-label="Close"
        onClick={() => setStars(null)}
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          background: 'transparent',
          border: 0,
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 18,
          cursor: 'pointer',
          padding: 4,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={18} />
      </button>
    </div>
  )
}

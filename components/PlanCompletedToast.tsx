'use client'

import { useEffect, useState } from 'react'

// Fixed top-center toast shown when a submission pushes the weekly
// study plan to 100%. Auto-hides after 6s; z-index above the confetti
// canvas (999) so the text stays readable through the burst.
export function PlanCompletedToast({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(t)
  }, [show])

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-sm font-bold"
      style={{
        zIndex: 1000,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
        color: 'white',
        boxShadow: '0 10px 40px rgba(16,185,129,0.35)',
      }}
    >
      🎉 Bu haftalik reja bajarildi! +50 ball olindi!
    </div>
  )
}

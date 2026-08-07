'use client'

import { usePresenceHeartbeat } from '@/lib/hooks/usePresenceHeartbeat'

// Zero-render tracker -- shunchaki hook'ni ishga tushiradi. Layout
// server component bo'lgani uchun hook'ni to'g'ridan-to'g'ri
// chaqirib bo'lmaydi; bu wrapper client bo'lib xizmat qiladi.
export function PresenceTracker() {
  usePresenceHeartbeat()
  return null
}

'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Presence heartbeat: har 30 soniyada `update_last_seen()` RPC'ni
// chaqiradi. Bu RPC profiles.last_seen_at ustunini now()'ga o'rnatadi.
// Admin panel oxirgi 2 daqiqa ichida yangilangan qatorlarni "online"
// deb ko'radi.
//
// Tab yashiringanda interval to'xtaydi (CPU tejash uchun) va qaytganda
// darrov bir marta ping + interval qayta boshlanadi.

export function usePresenceHeartbeat() {
  useEffect(() => {
    const supabase = createClient()
    let intervalId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const ping = async () => {
      if (cancelled) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // RPC error'ni yutamiz -- offline yoki DB muvaqqat muammosi
      // real UX ga ta'sir qilmasin. RPC builder .then bo'lgani uchun
      // Promise.resolve bilan o'rab .catch qo'llaymiz.
      try { await supabase.rpc('update_last_seen') } catch { /* noop */ }
    }

    const start = () => {
      if (intervalId != null) return
      void ping()
      intervalId = setInterval(ping, 30_000)
    }

    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    // Boshlang'ich holat: ko'rinib tursa boshlaymiz.
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}

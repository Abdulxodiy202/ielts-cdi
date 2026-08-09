'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Realtime map of the current user's most-recent booking per schedule.
// Used by the mock-test cards to react to admin approve/reject events
// without polling: pending → confirmed shows the "Confirmed" chip, and
// pending → rejected surfaces the 5-minute cooldown banner + timer.
//
// Why "per schedule" instead of one hook per card:
//   Same reason as useAllBookingCounts — a single filter-by-user_id
//   channel is enough for the whole page. RLS lets the user read their
//   own rows without a SECURITY DEFINER RPC (this is the one case where
//   the browser client's default policy does the right thing), so we
//   pull them directly.
//
// The returned map is keyed by schedule_id. If a user has multiple
// bookings for the same schedule (rare — should only happen after a
// rejection creates a new pending one), the map holds the newest by
// updated_at, which is what the cooldown timer needs anyway.

export interface MyBookingRow {
  id: string
  schedule_id: string
  status: string
  updated_at: string | null
  created_at: string
}

export function useMyBookings(
  scheduleIds: string[],
  userId: string | null,
): Record<string, MyBookingRow> {
  const [byScheduleId, setByScheduleId] = useState<Record<string, MyBookingRow>>({})

  const key = scheduleIds.slice().sort().join(',')

  useEffect(() => {
    if (!userId || scheduleIds.length === 0) { setByScheduleId({}); return }
    const supabase = createClient()
    let cancelled = false

    const fetchAll = async () => {
      const { data } = await supabase
        .from('mock_bookings')
        .select('id, schedule_id, status, updated_at, created_at')
        .eq('user_id', userId)
        .in('schedule_id', scheduleIds)
        // Newest first so the reduce below keeps the freshest row per
        // schedule when the user has multiple attempts on one session.
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (cancelled) return
      const map: Record<string, MyBookingRow> = {}
      for (const row of (data ?? []) as MyBookingRow[]) {
        if (!(row.schedule_id in map)) map[row.schedule_id] = row
      }
      setByScheduleId(map)
    }
    fetchAll()

    // One channel per page. RLS-filter by user_id on the subscription is
    // both a perf win (server only pushes our rows) and a correctness
    // one (avoids reacting to other users' events we couldn't read
    // anyway). Any change refetches the batch.
    //
    // The two console.log calls exist to diagnose the "admin rejected
    // but user's tab never updates" report:
    //   • '[useMyBookings] subscribe status' — should print 'SUBSCRIBED'
    //     within ~1s. If it prints 'CHANNEL_ERROR' or 'TIMED_OUT' the
    //     mock_bookings table isn't on supabase_realtime yet (fix:
    //     migration 033).
    //   • '[useMyBookings] event' — should print each time admin flips
    //     the row (UPDATE with new.status='rejected'). If admin clicks
    //     Reject and this doesn't print, the Telegram webhook isn't
    //     actually writing to mock_bookings; check its error log.
    const channel = supabase
      .channel(`my_bookings_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mock_bookings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log('[useMyBookings] event', payload.eventType, payload.new ?? payload.old)
          void fetchAll()
        },
      )
      .subscribe((status) => {
        // eslint-disable-next-line no-console
        console.log('[useMyBookings] subscribe status:', status)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId])

  return byScheduleId
}

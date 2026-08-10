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
  /** Set by /api/mock/disqualify when the user is caught cheating; the
   *  MockTestClient banner reads this and hides the Book button so the
   *  disqualified user can't rebook the same schedule. Nullable in
   *  older projects that predate migration 035 — treat null as false. */
  disqualified: boolean | null
  disqualified_at: string | null
  disqualified_reason: string | null
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
      // If migration 035 hasn't been applied yet the disqualified* columns
      // don't exist and Supabase returns 42703. On that error we fall
      // back to the pre-035 column set so the page keeps working —
      // disqualified data just stays null (treated as false client-side).
      const preferredCols = 'id, schedule_id, status, updated_at, created_at, disqualified, disqualified_at, disqualified_reason'
      const legacyCols    = 'id, schedule_id, status, updated_at, created_at'
      let { data, error } = await supabase
        .from('mock_bookings')
        .select(preferredCols)
        .eq('user_id', userId)
        .in('schedule_id', scheduleIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error?.code === '42703') {
        const fallback = await supabase
          .from('mock_bookings')
          .select(legacyCols)
          .eq('user_id', userId)
          .in('schedule_id', scheduleIds)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
        // Legacy rows lack the disqualified* columns; synthesize them
        // as null so the shape matches MyBookingRow and the client's
        // `Boolean(disqualified)` check evaluates to false.
        data = (fallback.data ?? []).map(r => ({
          ...(r as Record<string, unknown>),
          disqualified: null,
          disqualified_at: null,
          disqualified_reason: null,
        })) as typeof data
      }

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

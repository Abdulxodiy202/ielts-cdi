'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Realtime booking counts for a whole page's worth of schedules, using
// ONE channel per page (not one per card). The card only needs the
// current count for its schedule; when any row changes we refetch the
// batch — cheaper than maintaining a per-schedule subscription with
// server-side filters, and simpler than incrementing counts locally
// (avoids drift on race conditions / missed events).
//
// Only counts pending+confirmed rows; cancelled/resigned/disqualified
// bookings free their seat so capacity math treats them as if never
// booked, matching the payment API's guard.
//
// The dep key uses the sorted, joined id list so parent re-renders
// don't force resubscription unless the actual set of schedules changed.

const COUNTED_STATUSES = ['pending', 'confirmed'] as const

export function useAllBookingCounts(scheduleIds: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})

  // Stable key from ids so switching order or referential identity of
  // the parent array doesn't churn effect deps.
  const key = scheduleIds.slice().sort().join(',')

  useEffect(() => {
    if (scheduleIds.length === 0) { setCounts({}); return }
    const supabase = createClient()
    let cancelled = false

    const fetchAll = async () => {
      const { data } = await supabase
        .from('mock_bookings')
        .select('schedule_id, status')
        .in('schedule_id', scheduleIds)
        .in('status', COUNTED_STATUSES as unknown as string[])

      if (cancelled) return
      // Seed every id at 0 so consumers can freely read counts[id]
      // without null-checking; ids with no bookings stay 0.
      const map: Record<string, number> = {}
      for (const id of scheduleIds) map[id] = 0
      for (const b of (data ?? [])) {
        const sid = (b as { schedule_id: string }).schedule_id
        if (sid in map) map[sid] += 1
      }
      setCounts(map)
    }
    fetchAll()

    // One channel per page. `postgres_changes` without a filter fires
    // for every mock_bookings mutation; we refetch the batch on each
    // event, which stays cheap because the id set is a bounded page
    // (schedules the user currently sees).
    const channel = supabase
      .channel('mock_bookings_page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mock_bookings' },
        () => { void fetchAll() },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return counts
}

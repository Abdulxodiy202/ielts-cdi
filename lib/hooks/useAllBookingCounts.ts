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
// Why RPC instead of a direct SELECT:
//   mock_bookings RLS ("Users can manage own bookings") only lets a
//   caller see rows where auth.uid() = user_id. A browser-side COUNT
//   therefore only reports the CURRENT user's bookings, which made the
//   remaining-seats badge wrong the moment two different users booked
//   the same session. The RPC is SECURITY DEFINER (migration 031), so
//   it aggregates across all users while still keeping row contents
//   invisible — only the total per schedule is returned.
//
// Only counts pending+confirmed rows; cancelled/resigned bookings free
// their seat so capacity math treats them as if never booked, matching
// the payment API's guard.

interface BookedRow {
  schedule_id: string
  booked_count: number
}

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
      const { data, error } = await supabase.rpc('get_schedules_booked_counts', {
        p_schedule_ids: scheduleIds,
      })

      if (cancelled) return
      if (error) {
        // If the RPC doesn't exist yet (migration 031 not applied), fall
        // back to a direct SELECT so the UI still works in dev — it'll
        // just under-count until the migration lands. Log so it's not
        // silently wrong forever.
        // eslint-disable-next-line no-console
        console.warn('[useAllBookingCounts] RPC failed, falling back:', error.message)
        const fallback = await supabase
          .from('mock_bookings')
          .select('schedule_id, status')
          .in('schedule_id', scheduleIds)
          .in('status', ['pending', 'confirmed'])
        const map: Record<string, number> = {}
        for (const id of scheduleIds) map[id] = 0
        for (const b of (fallback.data ?? [])) {
          const sid = (b as { schedule_id: string }).schedule_id
          if (sid in map) map[sid] += 1
        }
        setCounts(map)
        return
      }

      // Seed every id at 0 so consumers can freely read counts[id]
      // without null-checking; ids with no bookings stay 0.
      const map: Record<string, number> = {}
      for (const id of scheduleIds) map[id] = 0
      for (const row of (data ?? []) as BookedRow[]) {
        if (row.schedule_id in map) map[row.schedule_id] = row.booked_count
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

/**
 * One-time seed: bring Reading & Listening tests to 35 total each.
 *
 * Rules:
 *   tests 1-5  → is_premium = false  (free)
 *   tests 6-35 → is_premium = true   (premium)
 *   tests 10-35 are inserted if they don't already exist.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xzxfsznyrrtunnbfxgww.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eGZzem55cnJ0dW5uYmZ4Z3d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3NTgxMSwiZXhwIjoyMDk2MTUxODExfQ.HFrRjp736CHkjefrgICszvWkfENG_ZifUF702pCoukk',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  // ── 1. Fetch all existing tests ──────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from('tests')
    .select('id, type, order_number, is_premium')
    .in('type', ['reading', 'listening'])

  if (fetchErr) { console.error('Fetch error:', fetchErr); process.exit(1) }

  // Build lookup: "reading-3" → { id, is_premium }
  const existingMap = {}
  for (const t of existing) {
    existingMap[`${t.type}-${t.order_number}`] = t
  }

  // ── 2. Update is_premium on tests 1-9 ───────────────────────────────
  // tests 1-5 → free, tests 6-9 → premium
  const updates = []
  for (const type of ['reading', 'listening']) {
    for (let n = 1; n <= 9; n++) {
      const key = `${type}-${n}`
      const row = existingMap[key]
      if (!row) continue
      const shouldBePremium = n >= 6
      if (row.is_premium !== shouldBePremium) {
        updates.push({ id: row.id, is_premium: shouldBePremium })
      }
    }
  }

  if (updates.length > 0) {
    for (const u of updates) {
      const { error } = await supabase.from('tests').update({ is_premium: u.is_premium }).eq('id', u.id)
      if (error) console.error(`Update error for ${u.id}:`, error)
      else console.log(`✓ Updated test ${u.id} → is_premium=${u.is_premium}`)
    }
  } else {
    console.log('✓ All existing tests 1-9 already have correct is_premium values')
  }

  // ── 3. Insert missing tests 10-35 ────────────────────────────────────
  const toInsert = []
  for (const type of ['reading', 'listening']) {
    for (let n = 10; n <= 35; n++) {
      const key = `${type}-${n}`
      if (!existingMap[key]) {
        const typeLabel = type === 'reading' ? 'Reading' : 'Listening'
        toInsert.push({
          title: `${typeLabel} Test ${n}`,
          type,
          order_number: n,
          is_premium: true,
          is_published: true,
          description: `IELTS Academic ${typeLabel} practice test ${n}`,
          file_url: null,
        })
      }
    }
  }

  if (toInsert.length === 0) {
    console.log('✓ All tests 10-35 already exist — nothing to insert')
    return
  }

  console.log(`Inserting ${toInsert.length} new tests…`)

  // Insert in batches of 20 to avoid payload limits
  const BATCH = 20
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error } = await supabase.from('tests').insert(batch).select('title, order_number')
    if (error) {
      console.error(`Insert batch error (i=${i}):`, error)
    } else {
      for (const row of data) console.log(`  ✓ Inserted: ${row.title}`)
    }
  }

  console.log('\nDone!')
}

run().catch(e => { console.error(e); process.exit(1) })
